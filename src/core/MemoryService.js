// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1
//
// CONTRACT GOAL:
// - Любой модуль, которому нужна память, вызывает ТОЛЬКО MemoryService.
// - Никакого прямого SQL к chat_memory из handlers/modules.
// - Реальный backend на данном этапе: chat_memory (через ChatMemoryAdapter).
//
// STAGE 7.7+ — Memory write buffering (micro-batch):
// - Optional queue + timed flush to reduce DB pressure under burst traffic.
// - NO schema changes. NO new modules.
// - Fail-open: if buffered flush fails, falls back to direct adapter call.
//
// Contract methods (V1):
// - write({ chatId, globalUserId, role, content, transport, metadata, schemaVersion })
// - writePair({ chatId, globalUserId, userText, assistantText, transport, metadata, schemaVersion })
// - recent({ chatId, globalUserId, limit, chatType }) -> [{role, content}, ...]
// - context({ chatId, globalUserId, limit, chatType }) -> { enabled, chatId, globalUserId, memories: [...] }
// - remember({ key, value, chatId, globalUserId, transport, metadata, schemaVersion })
// - status() -> diag info
//
// STAGE 11+ transitional universal read layer:
// - getLongTermByType(...)
// - getLongTermByKey(...)
// - getLongTermByDomain(...)
// - getLongTermBySlot(...)
// - getLongTermByDomainSlot(...)
// - getLongTermSummary(...)
// - selectLongTermContext(...)
// IMPORTANT:
// - read-only helpers only
// - no router changes
// - no AI logic here
// - no schema changes

import { getMemoryConfig } from "./memoryConfig.js";
import ChatMemoryAdapter from "./memoryAdapters/chatMemoryAdapter.js";
import MemoryLongTermReadService from "./memory/MemoryLongTermReadService.js";
import MemoryWriteService from "./memory/MemoryWriteService.js";
import MemoryBufferService from "./memory/MemoryBufferService.js";
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

function _envBool(name, fallback = false) {
  const v = String(process.env[name] || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function _envInt(name, fallback) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return n;
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

    // Read-only long-term retrieval service
    this.longTermRead = new MemoryLongTermReadService({
      db: this.db,
      logger: this.logger,
      getEnabled: () => this._enabled,
      contractVersion: MemoryService.CONTRACT_VERSION,
    });

    // Direct write/remember service
    this.writeService = new MemoryWriteService({
      chatAdapter: this.chatAdapter,
      logger: this.logger,
      getEnabled: () => this._enabled,
      getMode: () => this.config.mode || "CHAT_MEMORY_V1",
      contractVersion: MemoryService.CONTRACT_VERSION,
    });

    // ==========================================================
    // STAGE 7.7+ — micro-batch buffering (optional)
    // ==========================================================
    this._bufferEnabled = _envBool("MEMORY_BUFFER_ENABLED", false);
    this._bufferFlushMs = Math.max(25, Math.min(500, _envInt("MEMORY_BUFFER_FLUSH_MS", 100)));
    this._bufferMaxBatch = Math.max(10, Math.min(500, _envInt("MEMORY_BUFFER_MAX_BATCH", 200)));
    this._bufferMaxQueue = Math.max(50, Math.min(5000, _envInt("MEMORY_BUFFER_MAX_QUEUE", 1500)));

    this.bufferService = new MemoryBufferService({
      logger: this.logger,
      getEnabled: () => this._enabled,
      executeDirect: async (op) => this._executeDirect(op),
      contractVersion: MemoryService.CONTRACT_VERSION,
      flushMs: this._bufferFlushMs,
      maxBatch: this._bufferMaxBatch,
      maxQueue: this._bufferMaxQueue,
      enabled: this._bufferEnabled,
    });

    if (this._bufferEnabled) {
      this.bufferService.installShutdownHooksOnce();
      this.logger.info("Buffer enabled", {
        flushMs: this._bufferFlushMs,
        maxBatch: this._bufferMaxBatch,
        maxQueue: this._bufferMaxQueue,
      });
    }
  }

  async init() {
    this._enabled = !!this.config.enabled;
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "CHAT_MEMORY_V1",
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
      buffer: this.bufferService.status(),
    };
  }

  // ========================================================================
  // recent() — минимальный API для чтения истории
  // ========================================================================
  async recent({ globalUserId = null, chatId = null, limit, chatType = null } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;

    if (!this._enabled || !chatIdStr) return [];

    const history = await this.chatAdapter.getChatHistory({
      chatId: chatIdStr,
      limit,
      globalUserId: globalUserId || null,
      chatType,
    });

    return history || [];
  }

  // ========================================================================
  // context() — структурированный пакет для AI слоя
  // ========================================================================
  async context({ globalUserId = null, chatId = null, limit, chatType = null } = {}) {
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

    const memories = await this.recent({
      globalUserId,
      chatId: chatIdStr,
      limit,
      chatType,
    });

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
  // READ-ONLY LONG-TERM FACADE
  // ========================================================================
  async getLongTermByType(args = {}) {
    return this.longTermRead.getLongTermByType(args);
  }

  async getLongTermByKey(args = {}) {
    return this.longTermRead.getLongTermByKey(args);
  }

  async getLongTermByDomain(args = {}) {
    return this.longTermRead.getLongTermByDomain(args);
  }

  async getLongTermBySlot(args = {}) {
    return this.longTermRead.getLongTermBySlot(args);
  }

  async getLongTermByDomainSlot(args = {}) {
    return this.longTermRead.getLongTermByDomainSlot(args);
  }

  async getLongTermSummary(args = {}) {
    return this.longTermRead.getLongTermSummary(args);
  }

  async selectLongTermContext(args = {}) {
    return this.longTermRead.selectLongTermContext(args);
  }

  // ========================================================================
  // WRITE FACADE
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

    // Buffered path (optional)
    if (this._bufferEnabled) {
      return this.bufferService.enqueueAndWait({
        type: "message",
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        role: _safeStr(role),
        content,
        options: {
          transport: safeTransport,
          metadata: safeMeta,
          schemaVersion: sv,
        },
      });
    }

    return this.writeService.write({
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      role: _safeStr(role),
      content,
      transport: safeTransport,
      metadata: safeMeta,
      schemaVersion: sv,
    });
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

    const u = typeof userText === "string" ? userText : _safeStr(userText);
    const a = typeof assistantText === "string" ? assistantText : _safeStr(assistantText);

    // Buffered path (optional)
    if (this._bufferEnabled) {
      return this.bufferService.enqueueAndWait({
        type: "pair",
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        userText: u,
        assistantText: a,
        options: {
          transport: safeTransport,
          metadata: safeMeta,
          schemaVersion: sv,
        },
      });
    }

    return this.writeService.writePair({
      globalUserId: globalUserId || null,
      chatId: chatIdStr,
      userText: u,
      assistantText: a,
      transport: safeTransport,
      metadata: safeMeta,
      schemaVersion: sv,
    });
  }

  // ========================================================================
  // remember() — explicit long-term memory facade
  // ========================================================================
  async remember({
    key,
    value,
    globalUserId = null,
    chatId = null,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    return this.writeService.remember({
      key,
      value,
      globalUserId,
      chatId,
      transport,
      metadata,
      schemaVersion,
    });
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
      hasLongTermRead: !!this.longTermRead,
      hasWriteService: !!this.writeService,
      hasBufferService: !!this.bufferService,
      configKeys: Object.keys(this.config || {}),
      contractVersion: MemoryService.CONTRACT_VERSION,
      buffer: this.bufferService.status(),
    };
  }

  // ========================================================================
  // BACKWARD COMPAT (aliases)
  // ========================================================================

  async read({ globalUserId = null, chatId = null, limit, chatType = null } = {}) {
    return this.recent({ globalUserId, chatId, limit, chatType });
  }

  async getContext({ globalUserId = null, chatId = null, limit, chatType = null } = {}) {
    return this.context({ globalUserId, chatId, limit, chatType });
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
    return this.write({
      globalUserId,
      chatId,
      role,
      content,
      transport,
      metadata,
      schemaVersion,
    });
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

  // ========================================================================
  // INTERNAL: direct execution for buffer service
  // ========================================================================

  async _executeDirect(op) {
    const type = op?.type;

    if (type === "message") {
      return this.writeService.write({
        globalUserId: op.globalUserId || null,
        chatId: op.chatId,
        role: op.role,
        content: op.content,
        transport: op?.options?.transport || "telegram",
        metadata: op?.options?.metadata || {},
        schemaVersion: op?.options?.schemaVersion || 1,
      });
    }

    if (type === "pair") {
      return this.writeService.writePair({
        globalUserId: op.globalUserId || null,
        chatId: op.chatId,
        userText: op.userText,
        assistantText: op.assistantText,
        transport: op?.options?.transport || "telegram",
        metadata: op?.options?.metadata || {},
        schemaVersion: op?.options?.schemaVersion || 1,
      });
    }

    return {
      ok: false,
      enabled: this._enabled,
      stored: false,
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
      reason: "unknown_buffer_op",
    };
  }
}

export default MemoryService;