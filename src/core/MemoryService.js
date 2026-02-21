// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1 (SKELETON + ADAPTER WIRING)
// Пока без новой логики. Только подключение адаптера.

import { getMemoryConfig } from "./memoryConfig.js";
import ChatMemoryAdapter from "./memoryAdapters/chatMemoryAdapter.js";

// ✅ DB pool (root-level db.js). Used only for wiring/diagnostics at Stage 7.
import pool from "../../db.js";

export class MemoryService {
  constructor({ logger = null, db = null, config = null } = {}) {
    this.logger = logger;

    this.config = config || getMemoryConfig();
    this._enabled = !!this.config.enabled;

    // ✅ DB wiring:
    // - if caller provided db → use it
    // - else fallback to shared pool (does not change behavior, only makes wiring explicit)
    this.db = db || pool || null;

    // ✅ Подключаем существующий chatMemory через адаптер
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

  /**
   * Получить контекст для промпта.
   * Пока просто проксируем в chatMemoryAdapter.
   */
  async getContext({ globalUserId = null, chatId = null, limit } = {}) {
    if (!this._enabled || !chatId) {
      return {
        enabled: this._enabled,
        globalUserId,
        chatId,
        memories: [],
      };
    }

    const history = await this.chatAdapter.getChatHistory({
      chatId,
      limit,
    });

    return {
      enabled: this._enabled,
      globalUserId,
      chatId,
      memories: history || [],
    };
  }

  /**
   * Добавить сообщение (через адаптер)
   */
  async appendInteraction({
    globalUserId = null,
    chatId = null,
    role,
    content,
    metadata = {},
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

    await this.chatAdapter.saveMessage({
      chatId,
      role,
      content,
    });

    return {
      ok: true,
      enabled: this._enabled,
      stored: true,
      mode: this.config.mode || "SKELETON",
      size: content.length,
      metadata,
    };
  }

  /**
   * Сохранить пару user/assistant
   */
  async savePair({ chatId, userText, assistantText } = {}) {
    if (!this._enabled || !chatId) {
      return { ok: true, stored: false };
    }

    await this.chatAdapter.savePair({
      chatId,
      userText,
      assistantText,
    });

    return { ok: true, stored: true };
  }

  /**
   * PROJECT MEMORY — пока skeleton (не подключаем projectMemory.js)
   */
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
