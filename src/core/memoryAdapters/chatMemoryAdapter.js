// src/core/memoryAdapters/chatMemoryAdapter.js
// STAGE 7 — MEMORY LAYER V1 (SKELETON ADAPTER)
// Цель: обернуть существующий chatMemory.js, НЕ меняя его логику.
// Никакой новой БД-логики тут нет — только прокси-вызовы.

import {
  getChatHistory as _getChatHistory,
  saveMessageToMemory as _saveMessageToMemory,
  saveChatPair as _saveChatPair,
} from "../../memory/chatMemory.js";

export class ChatMemoryAdapter {
  constructor({ logger = null, config = {} } = {}) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Вернуть историю чата в формате [{role, content}, ...]
   */
  async getChatHistory({ chatId, limit } = {}) {
    if (!chatId) return [];
    return _getChatHistory(chatId, limit);
  }

  /**
   * Записать одно сообщение в chat_memory (через существующий модуль)
   */
  async saveMessage({ chatId, role, content } = {}) {
    if (!chatId) return { ok: false, reason: "missing_chatId" };
    if (!role) return { ok: false, reason: "missing_role" };
    if (typeof content !== "string") return { ok: false, reason: "invalid_content" };

    await _saveMessageToMemory(chatId, role, content);
    return { ok: true };
  }

  /**
   * Записать пару user+assistant (через существующий модуль)
   */
  async savePair({ chatId, userText, assistantText } = {}) {
    if (!chatId) return { ok: false, reason: "missing_chatId" };

    await _saveChatPair(chatId, userText || "", assistantText || "");
    return { ok: true };
  }
}

export default ChatMemoryAdapter;
