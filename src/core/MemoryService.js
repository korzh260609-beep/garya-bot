// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1
// STAGE 7.7 — MemoryService CONTRACT (SKELETON)
//
// CONTRACT GOAL:
// - Any module consuming memory must call MemoryService only.
// - Handlers/modules должны перестать делать прямой SQL к chat_memory.
// - Пока это skeleton: контракт зафиксирован, обратная совместимость сохранена.
//
// Contract methods (V1):
// - write({ chatId, globalUserId, role, content, transport, metadata, schemaVersion })
// - writePair({ chatId, globalUserId, userText, assistantText, transport, metadata, schemaVersion })
// - recent({ chatId, globalUserId, limit }) -> [{role, content}, ...]
// - context({ chatId, globalUserId, limit }) -> { enabled, chatId, globalUserId, memories: [...] }
// - status() -> diag info

import { getMemoryConfig } from "./memoryConfig.js";
import ChatMemoryAdapter from "./memoryAdapters/chatMemoryAdapter.js";
import pool from "../../db.js";

// ✅ простой базовый logger (skeleton)
const defaultLogger = {
  info: (...args) => console.log("[Memory]", ...args),
  error: (...args) => console.error("[Memory]", ...args),
};

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

export class MemoryService {
  static CONTRACT_VERSION = 1;

  constructor({ logger = null, db = null, config = null } = {}) {
    this.config = config || getMemoryConfig();
    this._enabled = !!this.config.enabled;

    // ✅ DB wiring (do not use directly from handlers; use adapter via MemoryService)
    this.db = db || pool || null;

    // ✅ Logger wiring
    this.logger = logger || defaultLogger;

    // ✅ Adapter wiring
    this.chatAdapter = new ChatMemoryAdapter({
      logger: this.logger,
      config: this.config,
    });
  }

  async init() {
    this._enabled = !!this.config.enabled;
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "SKELETON",
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // CONTRACT: recent() — минимальный API для чтения истории
  // ========================================================================
  async recent({ globalUserId = null, chatId = null, limit } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!this._enabled || !chatIdStr) return [];

    const history = await this.chatAdapter.getChatHistory({
      chatId: chatIdStr,
      limit,
      globalUserId: globalUserId || null,
    });

    return history || [];
  }

  // ========================================================================
  // CONTRACT: context() — структурированный пакет для AI слоя
  // ========================================================================
  async context({ globalUserId = null, chatId = null, limit } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!this._enabled || !chatIdStr) {
      return {
        enabled: this._enabled,
        globalUserId: globalUserId || null,
        chatId: chatIdStr,
        memories: [],
        contractVersion: MemoryService.CONTRACT_VERSION,
      };
    }

    const memories = await this.recent({ globalUserId, chatId: chatIdStr, limit });

    return {
      enabled: this._enabled,
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      memories: memories || [],
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // CONTRACT: write() — запись одного сообщения (user/assistant/system)
  // ========================================================================
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

    if (!this._enabled || !chatIdStr) {
      return {
        ok: true,
        enabled: this._enabled,
        stored: false,
        mode: this.config.mode || "SKELETON",
        contractVersion: MemoryService.CONTRACT_VERSION,
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);

    await this.chatAdapter.saveMessage({
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

    this.logger.info("Saved message", {
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      size: content.length,
      transport: safeTransport,
      sv,
    });

    return {
      ok: true,
      enabled: this._enabled,
      stored: true,
      mode: this.config.mode || "SKELETON",
      size: content.length,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      schemaVersion: sv,
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // CONTRACT: writePair() — запись user + assistant пары
  // ========================================================================
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

    if (!this._enabled || !chatIdStr) {
      return {
        ok: true,
        enabled: this._enabled,
        stored: false,
        contractVersion: MemoryService.CONTRACT_VERSION,
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);

    await this.chatAdapter.savePair({
      chatId: chatIdStr,
      userText: typeof userText === "string" ? userText : _safeStr(userText),
      assistantText: typeof assistantText === "string" ? assistantText : _safeStr(assistantText),
      globalUserId: globalUserId || null,
      options: {
        transport: safeTransport,
        metadata: safeMeta,
        schemaVersion: sv,
      },
    });

    this.logger.info("Saved pair", {
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      sv,
    });

    return {
      ok: true,
      enabled: this._enabled,
      stored: true,
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // STAGE 7A+ placeholder: remember() — отдельная “долгая память” (пока skeleton)
  // ========================================================================
  async remember({ key, value, metadata = {} } = {}) {
    if (!key || typeof value !== "string") {
      return { ok: false, reason: "invalid_input" };
    }

    return {
      ok: true,
      enabled: this._enabled,
      stored: false,
      mode: this.config.mode || "SKELETON",
      key,
      size: value.length,
      metadata: _safeObj(metadata),
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  async status() {
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "SKELETON",
      hasDb: !!this.db,
      hasLogger: !!this.logger,
      hasChatAdapter: !!this.chatAdapter,
      configKeys: Object.keys(this.config || {}),
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // BACKWARD COMPAT (aliases) — чтобы не ломать текущие вызовы
  // ========================================================================

  // старое имя
  async getContext({ globalUserId = null, chatId = null, limit } = {}) {
    return this.context({ globalUserId, chatId, limit });
  }

  // старое имя
  async appendInteraction({
    globalUserId = null,
    chatId = null,
    role,
    content,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    return this.write({ globalUserId, chatId, role, content, transport, metadata, schemaVersion });
  }

  // старое имя
  async savePair({
    globalUserId = null,
    chatId = null,
    userText,
    assistantText,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    return this.writePair({ globalUserId, chatId, userText, assistantText, transport, metadata, schemaVersion });
  }
}

export default MemoryService;
