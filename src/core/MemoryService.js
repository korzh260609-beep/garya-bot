Вот полный обновлённый src/core/MemoryService.js целиком — копируй и вставляй ✅

// src/core/MemoryService.js
// STAGE 7 — MEMORY LAYER V1 (SKELETON)
// ВАЖНО: это только каркас. Никаких SQL-запросов, никаких зависимостей от БД.
// Цель: единая точка входа для памяти, чтобы дальше подключать config → logic без ломания архитектуры.

import { getMemoryConfig } from "./memoryConfig.js";

export class MemoryService {
  /**
   * @param {object} deps
   * @param {object} [deps.logger] - логгер (optional)
   * @param {object} [deps.db] - db client/pool (НЕ используем в skeleton)
   * @param {object} [deps.config] - конфиг памяти (optional)
   */
  constructor({ logger = null, db = null, config = null } = {}) {
    this.logger = logger;
    this.db = db;

    // config: если не передан — берём из env через memoryConfig (это ещё НЕ логика памяти)
    this.config = config || getMemoryConfig();

    // skeleton: просто отражаем флаг enabled из конфига, без чтения/записи в БД
    this._enabled = !!this.config.enabled;
  }

  /**
   * Включение/инициализация (пока пусто)
   */
  async init() {
    // skeleton: ничего не делаем, только отражаем enabled из конфига
    this._enabled = !!this.config.enabled;
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "SKELETON",
    };
  }

  /**
   * Возвращает "память" для промпта (контекст).
   * @param {object} params
   * @param {string|number} [params.globalUserId]
   * @param {string|number} [params.chatId]
   */
  async getContext({ globalUserId = null, chatId = null } = {}) {
    // skeleton: пустой контекст
    return {
      enabled: this._enabled,
      globalUserId,
      chatId,
      memories: [],
    };
  }

  /**
   * Добавить запись о взаимодействии (пока no-op)
   * @param {object} params
   * @param {string|number} [params.globalUserId]
   * @param {string|number} [params.chatId]
   * @param {string} params.role - "user" | "assistant" | "system"
   * @param {string} params.content
   * @param {object} [params.metadata]
   */
  async appendInteraction({
    globalUserId = null,
    chatId = null,
    role,
    content,
    metadata = {},
  } = {}) {
    // skeleton: ничего не пишем в БД
    if (!role || typeof content !== "string") {
      return { ok: false, reason: "invalid_input" };
    }

    return {
      ok: true,
      enabled: this._enabled,
      stored: false,
      mode: this.config.mode || "SKELETON",
      globalUserId,
      chatId,
      role,
      size: content.length,
      metadata,
    };
  }

  /**
   * Сохранить "решение/факт" в проектную память (пока no-op)
   * @param {object} params
   * @param {string} params.key
   * @param {string} params.value
   * @param {object} [params.metadata]
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

  /**
   * Быстрый health-check памяти (для будущей /memory_status)
   */
  async status() {
    return {
      ok: true,
      enabled: this._enabled,
      mode: this.config.mode || "SKELETON",
      hasDb: !!this.db,
      hasLogger: !!this.logger,
      configKeys: Object.keys(this.config || {}),
    };
  }
}

export default MemoryService;
