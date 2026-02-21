// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1 (SKELETON + ADAPTER WIRING)

import { getMemoryConfig } from "./memoryConfig.js";
import ChatMemoryAdapter from "./memoryAdapters/chatMemoryAdapter.js";
import pool from "../../db.js";

// ✅ простой базовый logger (skeleton)
const defaultLogger = {
  info: (...args) => console.log("[Memory]", ...args),
  error: (...args) => console.error("[Memory]", ...args),
};

export class MemoryService {
  constructor({ logger = null, db = null, config = null } = {}) {
    this.config = config || getMemoryConfig();
    this._enabled = !!this.config.enabled;

    // ✅ DB wiring
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
    };
  }

  async getContext({ globalUserId = null, chatId = null, limit } = {}) {
    if (!this._enabled || !chatId) {
      return {
        enabled: this._enabled,
        globalUserId,
        chatId,
        memories: [],
      };
    }

    // ✅ STAGE 7.2 LOGIC: filter by globalUserId if provided
    const history = await this.chatAdapter.getChatHistory({
      chatId,
      limit,
      globalUserId,
    });

    return {
      enabled: this._enabled,
      globalUserId,
      chatId,
      memories: history || [],
    };
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
    if (!role || typeof content !== "string") {
      return { ok: false, reason: "invalid_input" };
    }

    if (!this._enabled || !chatId) {
      return {
        ok: true,
        enabled: this._enabled,
        stored: false,
        mode: this.config.mode || "SKELETON",
      };
    }

    // ✅ STAGE 7.2 LOGIC: write globalUserId + options into v2 columns
    await this.chatAdapter.saveMessage({
      chatId,
      role,
      content,
      globalUserId,
      options: {
        transport: transport || "telegram",
        metadata: metadata || {},
        schemaVersion: schemaVersion || 1,
      },
    });

    this.logger.info("Saved message", {
      chatId,
      globalUserId,
      size: content.length,
    });

    return {
      ok: true,
      enabled: this._enabled,
      stored: true,
      mode: this.config.mode || "SKELETON",
      size: content.length,
      globalUserId,
      metadata,
    };
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
    if (!this._enabled || !chatId) {
      return { ok: true, stored: false };
    }

    // ✅ STAGE 7.2 LOGIC: write pair with globalUserId + options
    await this.chatAdapter.savePair({
      chatId,
      userText,
      assistantText,
      globalUserId,
      options: {
        transport: transport || "telegram",
        metadata: metadata || {},
        schemaVersion: schemaVersion || 1,
      },
    });

    this.logger.info("Saved pair", { chatId, globalUserId });

    return { ok: true, stored: true };
  }

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
      metadata,
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
    };
  }
}

export default MemoryService;
