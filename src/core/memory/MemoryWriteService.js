// src/core/memory/MemoryWriteService.js
// STAGE 11.x — extracted write/remember service
//
// Goal:
// - move write logic out of MemoryService
// - keep MemoryService as facade/orchestrator
// - NO schema changes
// - NO router changes
// - deterministic only
//
// IMPORTANT:
// - buffering still stays in MemoryService
// - this service supports direct write path + remember()
// - public contract stays controlled by MemoryService facade
//
// STAGE 7.9.1 — confirmed facts write path
// - remember() now checks confirmed-memory duplicate/conflict guard before write.
// - Existing facts are read in MemoryWriteService runtime layer, not inside the guard.
// - Guard remains deterministic and read-only.
// - No schema changes. No handler changes. No archive/digest runtime changes.

import { deriveRememberTypeFromKey } from "../rememberType.js";
import { deriveExplicitRememberStructure } from "../explicitRememberStructure.js";
import MemoryConfirmedGuard from "./MemoryConfirmedGuard.js";
import pool from "../../../db.js";

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _normalizeTransport(t) {
  const v = _safeStr(t).trim();
  return v || "telegram";
}

function _normalizeSchemaVersion(sv) {
  const n = Number(sv);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return n;
}

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

function _extractRememberValue(content) {
  const text = _safeStr(content).trim();
  const m = /^\[MEMORY:[^\]]+\]\s*(.+)$/s.exec(text);
  if (m && m[1]) return String(m[1]).trim();
  return text;
}

function _normalizeExistingConfirmedRow(row = {}) {
  const metadata = _safeObj(row?.metadata);
  const key =
    _safeStr(metadata?.rememberKey).trim() ||
    _safeStr(metadata?.memoryKey).trim() ||
    _safeStr(metadata?.key).trim();
  const value =
    _safeStr(metadata?.value).trim() ||
    _extractRememberValue(row?.content);

  return {
    id: row?.id ?? null,
    key,
    memoryKey: key,
    value,
    content: _safeStr(row?.content),
    metadata,
  };
}

export class MemoryWriteService {
  constructor({
    chatAdapter = null,
    logger = console,
    getEnabled = () => false,
    getMode = () => "CHAT_MEMORY_V1",
    contractVersion = 1,
    db = null,
    confirmedGuard = null,
  } = {}) {
    this.chatAdapter = chatAdapter || null;
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.getMode =
      typeof getMode === "function" ? getMode : () => "CHAT_MEMORY_V1";
    this.contractVersion = contractVersion;
    this.db = db || pool || null;
    this.confirmedGuard =
      confirmedGuard ||
      new MemoryConfirmedGuard({
        logger: this.logger,
        getEnabled: this.getEnabled,
        contractVersion: this.contractVersion,
      });
  }

  async _readExistingConfirmedByKey({
    globalUserId = null,
    chatId = null,
    rememberKey = null,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberKeyStr = _safeStr(rememberKey).trim();
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(Number(limit) || 20)));

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: [],
        total: 0,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      };
    }

    if (!rememberKeyStr) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: [],
        total: 0,
        reason: "missing_rememberKey",
      };
    }

    if (!this.db) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: [],
        total: 0,
        reason: "db_unavailable",
      };
    }

    try {
      const params = [chatIdStr, rememberKeyStr];
      let idx = 3;
      let globalUserSql = "";

      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          content,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberKey', '') = $2
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const items = (res.rows || []).map(_normalizeExistingConfirmedRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items,
        total: items.length,
      };
    } catch (e) {
      this.logger.error("read existing confirmed memory failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: [],
        total: 0,
        reason: "read_existing_confirmed_memory_failed",
        error: e?.message || String(e),
      };
    }
  }

  async write({
    globalUserId = null,
    chatId = null,
    role,
    content,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!role || typeof content !== "string") {
      return { ok: false, reason: "invalid_input" };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        stored: false,
        mode: this.getMode(),
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    }

    if (!this.chatAdapter) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        stored: false,
        mode: this.getMode(),
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "chat_adapter_unavailable",
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);

    const r = await this.chatAdapter.saveMessage({
      chatId: chatIdStr,
      role: _safeStr(role),
      content,
      globalUserId: globalUserId || null,
      options: {
        transport: safeTransport,
        metadata: safeMeta,
        schemaVersion: sv,
      },
    });

    const ok = r?.ok !== false;

    if (ok) {
      this.logger.info("Saved message", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        size: content.length,
        transport: safeTransport,
        sv,
      });
    } else {
      this.logger.error("Save message failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        sv,
        reason: r?.reason || "unknown",
      });
    }

    return {
      ok,
      enabled: !!this.getEnabled(),
      stored: ok,
      mode: this.getMode(),
      backend: "chat_memory",
      size: content.length,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      schemaVersion: sv,
      contractVersion: this.contractVersion,
    };
  }

  async writePair({
    globalUserId = null,
    chatId = null,
    userText,
    assistantText,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    }

    if (!this.chatAdapter) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "chat_adapter_unavailable",
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);

    const u = typeof userText === "string" ? userText : _safeStr(userText);
    const a =
      typeof assistantText === "string" ? assistantText : _safeStr(assistantText);

    const r = await this.chatAdapter.savePair({
      chatId: chatIdStr,
      userText: u,
      assistantText: a,
      globalUserId: globalUserId || null,
      options: {
        transport: safeTransport,
        metadata: safeMeta,
        schemaVersion: sv,
      },
    });

    const ok = r?.ok !== false;

    if (ok) {
      this.logger.info("Saved pair", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        sv,
      });
    } else {
      this.logger.error("Save pair failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        sv,
        reason: r?.reason || "unknown",
      });
    }

    return {
      ok,
      enabled: !!this.getEnabled(),
      stored: ok,
      backend: "chat_memory",
      contractVersion: this.contractVersion,
    };
  }

  async remember({
    key,
    value,
    globalUserId = null,
    chatId = null,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const keyStr = _safeStr(key).trim();
    const valueStr =
      typeof value === "string" ? value.trim() : _safeStr(value).trim();
    const chatIdStr = chatId ? String(chatId) : null;

    if (!keyStr || !valueStr) {
      return { ok: false, reason: "invalid_input" };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        key: keyStr,
        size: valueStr.length,
        metadata: _safeObj(metadata),
        contractVersion: this.contractVersion,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);
    const rememberType = deriveRememberTypeFromKey(keyStr);

    const structured = deriveExplicitRememberStructure({
      key: keyStr,
      value: valueStr,
    });

    const rememberDomain =
      _safeStr(structured?.domain).trim() || "user_memory";
    const rememberSlot = _safeStr(structured?.slot).trim() || "generic";
    const rememberCanonicalKey =
      _safeStr(structured?.canonicalKey).trim() ||
      `${rememberDomain}.${rememberSlot}`;

    const existingRead = await this._readExistingConfirmedByKey({
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      rememberKey: keyStr,
      limit: 20,
    });

    if (existingRead?.ok !== true) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        key: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        size: valueStr.length,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        schemaVersion: sv,
        metadata: {
          ...safeMeta,
          memoryType: "long_term",
          rememberKey: keyStr,
          rememberType,
          rememberDomain,
          rememberSlot,
          rememberCanonicalKey,
          explicit: true,
        },
        contractVersion: this.contractVersion,
        reason: "confirmed_memory_existing_read_failed",
        guardDecision: "FAIL_CLOSED_EXISTING_READ_FAILED",
        existingReadReason: existingRead?.reason || "unknown",
        existingReadError: existingRead?.error || null,
      };
    }

    const guardRes = this.confirmedGuard.assertConfirmedCandidateAllowed({
      candidate: {
        key: keyStr,
        value: valueStr,
        explicit: true,
        intent: "remember",
        memoryType: "long_term",
      },
      existing: existingRead.items || [],
      metadata: {
        ...safeMeta,
        key: keyStr,
        value: valueStr,
        explicit: true,
        intent: "remember",
        memoryType: "long_term",
        rememberKey: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
      },
    });

    if (guardRes?.decision === "NOOP_DUPLICATE") {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        key: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        size: valueStr.length,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        schemaVersion: sv,
        metadata: {
          ...safeMeta,
          memoryType: "long_term",
          rememberKey: keyStr,
          rememberType,
          rememberDomain,
          rememberSlot,
          rememberCanonicalKey,
          explicit: true,
        },
        contractVersion: this.contractVersion,
        reason: "duplicate_confirmed_memory_noop",
        guardDecision: guardRes.decision,
        guardWarnings: guardRes.warnings || [],
        guardMatches: guardRes.matches || {},
      };
    }

    if (guardRes?.ok !== true) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        stored: false,
        backend: "chat_memory",
        key: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        size: valueStr.length,
        globalUserId: globalUserId || null,
        transport: safeTransport,
        schemaVersion: sv,
        metadata: {
          ...safeMeta,
          memoryType: "long_term",
          rememberKey: keyStr,
          rememberType,
          rememberDomain,
          rememberSlot,
          rememberCanonicalKey,
          explicit: true,
        },
        contractVersion: this.contractVersion,
        reason: "confirmed_memory_guard_blocked",
        guardDecision: guardRes?.decision || "BLOCK_MANUAL_REVIEW",
        guardErrors: guardRes?.errors || ["confirmed_memory_guard_failed"],
        guardWarnings: guardRes?.warnings || [],
        guardMatches: guardRes?.matches || {},
      };
    }

    const rememberContent = `[MEMORY:${keyStr}] ${valueStr}`;

    const writeRes = await this.write({
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      role: "system",
      content: rememberContent,
      transport: safeTransport,
      metadata: {
        ...safeMeta,
        memoryType: "long_term",
        rememberKey: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        explicit: true,
        source: safeMeta.source || "MemoryWriteService.remember",
      },
      schemaVersion: sv,
    });

    const ok = writeRes?.ok === true;
    const stored = writeRes?.stored === true;

    if (stored) {
      this.logger.info("Saved remember", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        key: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        transport: safeTransport,
        sv,
      });
    } else {
      this.logger.error("Save remember failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        key: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        transport: safeTransport,
        sv,
        reason: writeRes?.reason || "unknown",
      });
    }

    return {
      ok,
      enabled: !!this.getEnabled(),
      stored,
      backend: "chat_memory",
      key: keyStr,
      rememberType,
      rememberDomain,
      rememberSlot,
      rememberCanonicalKey,
      size: valueStr.length,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      schemaVersion: sv,
      metadata: {
        ...safeMeta,
        memoryType: "long_term",
        rememberKey: keyStr,
        rememberType,
        rememberDomain,
        rememberSlot,
        rememberCanonicalKey,
        explicit: true,
      },
      contractVersion: this.contractVersion,
      guardDecision: guardRes?.decision || "ALLOW_CANDIDATE",
      guardWarnings: guardRes?.warnings || [],
      guardMatches: guardRes?.matches || {},
      reason: stored
        ? "remember_saved"
        : writeRes?.reason || "remember_save_failed",
    };
  }
}

export default MemoryWriteService;