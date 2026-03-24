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

import { deriveRememberTypeFromKey } from "../rememberType.js";
import { deriveExplicitRememberStructure } from "../explicitRememberStructure.js";

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

export class MemoryWriteService {
  constructor({
    chatAdapter = null,
    logger = console,
    getEnabled = () => false,
    getMode = () => "CHAT_MEMORY_V1",
    contractVersion = 1,
  } = {}) {
    this.chatAdapter = chatAdapter || null;
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.getMode =
      typeof getMode === "function" ? getMode : () => "CHAT_MEMORY_V1";
    this.contractVersion = contractVersion;
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
      reason: stored
        ? "remember_saved"
        : writeRes?.reason || "remember_save_failed",
    };
  }
}

export default MemoryWriteService;