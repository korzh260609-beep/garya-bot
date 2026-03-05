// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1
//
// CONTRACT GOAL:
// - Любой модуль, которому нужна память, вызывает ТОЛЬКО MemoryService.
// - Никакого прямого SQL к chat_memory из handlers/modules.
// - Реальный backend на данном этапе: chat_memory (через ChatMemoryAdapter).
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

// Минимальный базовый logger (можно заменить внешним)
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

    // DB wiring (НЕ использовать напрямую из handlers; только через adapter)
    this.db = db || pool || null;

    // Logger wiring
    this.logger = logger || defaultLogger;

    // Adapter wiring (chat_memory backend)
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
      mode: this.config.mode || "CHAT_MEMORY_V1",
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // recent() — минимальный API для чтения истории
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
  // context() — структурированный пакет для AI слоя
  // ========================================================================
  async context({ globalUserId = null, chatId = null, limit } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!this._enabled || !chatIdStr) {
      return {
        enabled: this._enabled,
        globalUserId: globalUserId || null,
        chatId: chatIdStr,
        memories: [],
        backend: "chat_memory",
        contractVersion: MemoryService.CONTRACT_VERSION,
      };
    }

    const memories = await this.recent({ globalUserId, chatId: chatIdStr, limit });

    return {
      enabled: this._enabled,
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      memories: memories || [],
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // write() — запись одного сообщения (user/assistant/system)
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
        mode: this.config.mode || "CHAT_MEMORY_V1",
        backend: "chat_memory",
        contractVersion: MemoryService.CONTRACT_VERSION,
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

    // adapter может вернуть ok:false — отражаем честно
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
      enabled: this._enabled,
      stored: ok,
      mode: this.config.mode || "CHAT_MEMORY_V1",
      backend: "chat_memory",
      size: content.length,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      schemaVersion: sv,
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // writePair() — запись user + assistant пары
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
        backend: "chat_memory",
        contractVersion: MemoryService.CONTRACT_VERSION,
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);

    const r = await this.chatAdapter.savePair({
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
      enabled: this._enabled,
      stored: ok,
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // remember() — reserved for future “curated long-term memory”
  // На Stage 7 не пишем никуда (честный no-op).
  // ========================================================================
  async remember({ key, value, metadata = {} } = {}) {
    if (!key || typeof value !== "string") {
      return { ok: false, reason: "invalid_input" };
    }

    return {
      ok: true,
      enabled: this._enabled,
      stored: false,
      backend: "none",
      key,
      size: value.length,
      metadata: _safeObj(metadata),
      contractVersion: MemoryService.CONTRACT_VERSION,
      reason: "remember_not_implemented_stage7",
    };
  }

  async status() {
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "CHAT_MEMORY_V1",
      backend: "chat_memory",
      hasDb: !!this.db,
      hasLogger: !!this.logger,
      hasChatAdapter: !!this.chatAdapter,
      configKeys: Object.keys(this.config || {}),
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // BACKWARD COMPAT (aliases)
  // ========================================================================

  async read({ globalUserId = null, chatId = null, limit } = {}) {
    return this.recent({ globalUserId, chatId, limit });
  }

  async getContext({ globalUserId = null, chatId = null, limit } = {}) {
    return this.context({ globalUserId, chatId, limit });
  }

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

  async savePair({
    globalUserId = null,
    chatId = null,
    userText,
    assistantText,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    return this.writePair({
      globalUserId,
      chatId,
      userText,
      assistantText,
      transport,
      metadata,
      schemaVersion,
    });
  }
}

export default MemoryService;