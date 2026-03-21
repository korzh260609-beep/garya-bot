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
// - recent({ chatId, globalUserId, limit }) -> [{role, content}, ...]
// - context({ chatId, globalUserId, limit }) -> { enabled, chatId, globalUserId, memories: [...] }
// - remember({ key, value, chatId, globalUserId, transport, metadata, schemaVersion })
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

function _deriveRememberTypeFromKey(key) {
  const k = _safeStr(key).trim().toLowerCase();

  if (!k) return "general_fact";

  // ==========================================================
  // TASK / SCHEDULE
  // ==========================================================
  if (k === "task_schedule") {
    return "task_intent";
  }

  // ==========================================================
  // VEHICLE PROFILE
  // ==========================================================
  if (k === "car" || k === "car_engine" || k === "car_trim") {
    return "vehicle_profile";
  }

  // ==========================================================
  // MAINTENANCE INTERVALS
  // ==========================================================
  if (
    k === "maintenance_oil_interval" ||
    k === "maintenance_fuel_filter_interval" ||
    k === "maintenance_haldex_interval"
  ) {
    return "maintenance_interval";
  }

  // ==========================================================
  // MAINTENANCE FACTS / LAST CHANGE
  // ==========================================================
  if (
    k === "maintenance_oil_last_change" ||
    k === "maintenance_fuel_filter_last_change" ||
    k === "maintenance_haldex_last_change" ||
    k === "car_service_fact"
  ) {
    return "maintenance_fact";
  }

  // ==========================================================
  // FALLBACK
  // IMPORTANT:
  // - unknown / generic remembered facts must still get a broad type
  // - this is the first universal layer above rememberKey
  // ==========================================================
  if (k === "user_explicit_memory") {
    return "general_fact";
  }

  return "general_fact";
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

    // ==========================================================
    // STAGE 7.7+ — micro-batch buffering (optional)
    // ==========================================================
    this._bufferEnabled = _envBool("MEMORY_BUFFER_ENABLED", false);
    this._bufferFlushMs = Math.max(25, Math.min(500, _envInt("MEMORY_BUFFER_FLUSH_MS", 100)));
    this._bufferMaxBatch = Math.max(10, Math.min(500, _envInt("MEMORY_BUFFER_MAX_BATCH", 200)));
    this._bufferMaxQueue = Math.max(50, Math.min(5000, _envInt("MEMORY_BUFFER_MAX_QUEUE", 1500)));

    this._queue = [];
    this._flushTimer = null;
    this._flushInFlight = false;
    this._shutdownHooksInstalled = false;

    if (this._bufferEnabled) {
      this._installShutdownHooksOnce();
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
      buffer: {
        enabled: this._bufferEnabled,
        flushMs: this._bufferFlushMs,
        maxBatch: this._bufferMaxBatch,
        maxQueue: this._bufferMaxQueue,
      },
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

    // Buffered path (optional)
    if (this._bufferEnabled) {
      return await this._enqueueAndWait({
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

    // Direct path (default)
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

    const u = typeof userText === "string" ? userText : _safeStr(userText);
    const a = typeof assistantText === "string" ? assistantText : _safeStr(assistantText);

    // Buffered path (optional)
    if (this._bufferEnabled) {
      return await this._enqueueAndWait({
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

    // Direct path (default)
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
      enabled: this._enabled,
      stored: ok,
      backend: "chat_memory",
      contractVersion: MemoryService.CONTRACT_VERSION,
    };
  }

  // ========================================================================
  // remember() — minimal explicit long-term memory V1
  // Rules:
  // - only explicit remember-call should use this method
  // - no AI extraction here
  // - no new schema
  // - persisted through chat_memory backend as system memory record
  //
  // STAGE 7.4+ — rememberType layer (first broad semantic bucket)
  // IMPORTANT:
  // - no DB schema change
  // - stored only in metadata.rememberType
  // - rememberKey remains authoritative exact key
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
    const keyStr = _safeStr(key).trim();
    const valueStr = typeof value === "string" ? value.trim() : _safeStr(value).trim();
    const chatIdStr = chatId ? String(chatId) : null;

    if (!keyStr || !valueStr) {
      return { ok: false, reason: "invalid_input" };
    }

    if (!this._enabled || !chatIdStr) {
      return {
        ok: true,
        enabled: this._enabled,
        stored: false,
        backend: "chat_memory",
        key: keyStr,
        size: valueStr.length,
        metadata: _safeObj(metadata),
        contractVersion: MemoryService.CONTRACT_VERSION,
        reason: !this._enabled ? "memory_disabled" : "missing_chatId",
      };
    }

    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const sv = _normalizeSchemaVersion(schemaVersion);
    const rememberType = _deriveRememberTypeFromKey(keyStr);

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
        explicit: true,
        source: safeMeta.source || "MemoryService.remember",
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
        transport: safeTransport,
        sv,
      });
    } else {
      this.logger.error("Save remember failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        key: keyStr,
        rememberType,
        transport: safeTransport,
        sv,
        reason: writeRes?.reason || "unknown",
      });
    }

    return {
      ok,
      enabled: this._enabled,
      stored,
      backend: "chat_memory",
      key: keyStr,
      rememberType,
      size: valueStr.length,
      globalUserId: globalUserId || null,
      transport: safeTransport,
      schemaVersion: sv,
      metadata: {
        ...safeMeta,
        memoryType: "long_term",
        rememberKey: keyStr,
        rememberType,
        explicit: true,
      },
      contractVersion: MemoryService.CONTRACT_VERSION,
      reason: stored ? "remember_saved" : writeRes?.reason || "remember_save_failed",
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
      buffer: {
        enabled: this._bufferEnabled,
        flushMs: this._bufferFlushMs,
        maxBatch: this._bufferMaxBatch,
        maxQueue: this._bufferMaxQueue,
        queueSize: Array.isArray(this._queue) ? this._queue.length : 0,
        inFlight: !!this._flushInFlight,
      },
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

  // ========================================================================
  // INTERNAL: buffering helpers
  // ========================================================================

  _installShutdownHooksOnce() {
    if (this._shutdownHooksInstalled) return;
    this._shutdownHooksInstalled = true;

    const flushAndLog = async (reason) => {
      try {
        await this._flushQueue(reason);
      } catch (e) {
        this.logger.error("Flush on shutdown failed (fail-open)", { reason, err: e?.message || e });
      }
    };

    // Render sends SIGTERM on deploy/restart
    process.on("SIGTERM", () => {
      flushAndLog("SIGTERM").finally(() => process.exit(0));
    });

    process.on("SIGINT", () => {
      flushAndLog("SIGINT").finally(() => process.exit(0));
    });

    process.on("beforeExit", () => {
      // best-effort
      flushAndLog("beforeExit");
    });
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null;
      this._flushQueue("timer").catch((e) => {
        this.logger.error("Buffered flush failed (fail-open)", { err: e?.message || e });
      });
    }, this._bufferFlushMs);
  }

  async _enqueueAndWait(op) {
    try {
      if (!Array.isArray(this._queue)) this._queue = [];

      // Backpressure: if queue too large, do direct write (fail-open, avoid OOM)
      if (this._queue.length >= this._bufferMaxQueue) {
        this.logger.error("Buffer queue overflow -> direct write (fail-open)", {
          size: this._queue.length,
          maxQueue: this._bufferMaxQueue,
          type: op?.type || "unknown",
        });
        return await this._executeDirect(op);
      }

      return await new Promise((resolve) => {
        this._queue.push({
          op,
          resolve,
          enqueuedAt: Date.now(),
        });
        this._scheduleFlush();
      });
    } catch (e) {
      // fail-open
      this.logger.error("Enqueue failed -> direct write (fail-open)", { err: e?.message || e });
      return await this._executeDirect(op);
    }
  }

  async _flushQueue(reason = "unknown") {
    if (this._flushInFlight) return;
    this._flushInFlight = true;

    try {
      while (this._queue.length > 0) {
        const batch = this._queue.splice(0, this._bufferMaxBatch);

        // Execute sequentially (no schema change; adapter stays authoritative).
        // This still reduces overhead under burst (coalesces flush scheduling).
        for (const item of batch) {
          const { op, resolve } = item || {};
          if (!op || typeof resolve !== "function") continue;

          try {
            const res = await this._executeDirect(op);
            resolve(res);
          } catch (e) {
            // fail-open per item: return ok:false but don't crash flush
            this.logger.error("Buffered item failed (fail-open)", {
              reason,
              type: op?.type || "unknown",
              err: e?.message || e,
            });

            resolve({
              ok: false,
              enabled: this._enabled,
              stored: false,
              backend: "chat_memory",
              contractVersion: MemoryService.CONTRACT_VERSION,
              reason: "buffered_item_failed",
            });
          }
        }

        // Yield to event loop to avoid long blocking on huge backlogs
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      this._flushInFlight = false;
    }
  }

  async _executeDirect(op) {
    const type = op?.type;

    if (type === "message") {
      const r = await this.chatAdapter.saveMessage({
        chatId: op.chatId,
        role: op.role,
        content: op.content,
        globalUserId: op.globalUserId || null,
        options: op.options || {},
      });

      const ok = r?.ok !== false;

      if (ok) {
        this.logger.info("Saved message", {
          chatId: op.chatId,
          globalUserId: op.globalUserId || null,
          size: typeof op.content === "string" ? op.content.length : 0,
          transport: op?.options?.transport || "telegram",
          sv: op?.options?.schemaVersion || 1,
        });
      } else {
        this.logger.error("Save message failed", {
          chatId: op.chatId,
          globalUserId: op.globalUserId || null,
          transport: op?.options?.transport || "telegram",
          sv: op?.options?.schemaVersion || 1,
          reason: r?.reason || "unknown",
        });
      }

      return {
        ok,
        enabled: this._enabled,
        stored: ok,
        mode: this.config.mode || "CHAT_MEMORY_V1",
        backend: "chat_memory",
        size: typeof op.content === "string" ? op.content.length : 0,
        globalUserId: op.globalUserId || null,
        transport: op?.options?.transport || "telegram",
        schemaVersion: op?.options?.schemaVersion || 1,
        contractVersion: MemoryService.CONTRACT_VERSION,
        buffered: !!this._bufferEnabled,
      };
    }

    if (type === "pair") {
      const r = await this.chatAdapter.savePair({
        chatId: op.chatId,
        userText: op.userText,
        assistantText: op.assistantText,
        globalUserId: op.globalUserId || null,
        options: op.options || {},
      });

      const ok = r?.ok !== false;

      if (ok) {
        this.logger.info("Saved pair", {
          chatId: op.chatId,
          globalUserId: op.globalUserId || null,
          transport: op?.options?.transport || "telegram",
          sv: op?.options?.schemaVersion || 1,
        });
      } else {
        this.logger.error("Save pair failed", {
          chatId: op.chatId,
          globalUserId: op.globalUserId || null,
          transport: op?.options?.transport || "telegram",
          sv: op?.options?.schemaVersion || 1,
          reason: r?.reason || "unknown",
        });
      }

      return {
        ok,
        enabled: this._enabled,
        stored: ok,
        backend: "chat_memory",
        contractVersion: MemoryService.CONTRACT_VERSION,
        buffered: !!this._bufferEnabled,
      };
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