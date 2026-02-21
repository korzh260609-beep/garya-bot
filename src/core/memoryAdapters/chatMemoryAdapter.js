// src/core/memoryAdapters/chatMemoryAdapter.js
// STAGE 7 — MEMORY LAYER V1 (ADAPTER)
// Цель: прокси к src/memory/chatMemory.js
//
// STAGE 7.2 LOGIC: прокидываем globalUserId/options в v2-колонки.

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
   * v2: если есть globalUserId — фильтрация по нему
   */
  async getChatHistory({ chatId, limit, globalUserId = null } = {}) {
    if (!chatId) return [];
    return _getChatHistory(chatId, limit, { globalUserId });
  }

  /**
   * Записать одно сообщение в chat_memory
   * v2: options -> globalUserId/transport/metadata/schemaVersion
   */
  async saveMessage({ chatId, role, content, globalUserId = null, options = {} } = {}) {
    if (!chatId) return { ok: false, reason: "missing_chatId" };
    if (!role) return { ok: false, reason: "missing_role" };
    if (typeof content !== "string") return { ok: false, reason: "invalid_content" };

    await _saveMessageToMemory(chatId, role, content, {
      globalUserId,
      transport: options.transport,
      metadata: options.metadata,
      schemaVersion: options.schemaVersion,
    });

    return { ok: true };
  }

  /**
   * Записать пару user+assistant
   * v2: options -> globalUserId/transport/metadata/schemaVersion
   */
  async savePair({ chatId, userText, assistantText, globalUserId = null, options = {} } = {}) {
    if (!chatId) return { ok: false, reason: "missing_chatId" };

    await _saveChatPair(chatId, userText || "", assistantText || "", {
      globalUserId,
      transport: options.transport,
      metadata: options.metadata,
      schemaVersion: options.schemaVersion,
    });

    return { ok: true };
  }
}

export default ChatMemoryAdapter;
