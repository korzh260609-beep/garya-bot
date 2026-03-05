// src/memory/chatMemory.js
// ⚠️ DEPRECATED — STAGE 7 MEMORY LAYER V1
//
// Этот файл оставлен ТОЛЬКО для обратной совместимости.
// Правило Stage 7: handlers/modules НЕ должны ходить в DB напрямую.
// Единственный путь: MemoryService.
//
// Сейчас этот файл НЕ содержит SQL и просто проксирует в MemoryService.
// Удалять файл пока нельзя (могут быть старые импорты).

import { getMemoryService } from "../core/memoryServiceFactory.js";

const MAX_HISTORY_MESSAGES = 20;

function _toString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

/**
 * Возвращает историю чата [{role, content}, ...]
 * DEPRECATED: используйте MemoryService.recent()
 */
export async function getChatHistory(chatId, limit = MAX_HISTORY_MESSAGES, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return [];

  if (memory?.config?.enabled) {
    return memory.recent({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      limit,
    });
  }

  // memory disabled -> empty (safe)
  return [];
}

/**
 * Старый хелпер очистки истории.
 * STAGE 7: retention/cleanup делается отдельным RetentionService, не тут.
 * Оставлено как no-op для совместимости.
 */
export async function cleanupChatHistory(_chatId, _maxMessages = MAX_HISTORY_MESSAGES) {
  return { ok: true, skipped: true, reason: "deprecated_noop_stage7" };
}

/**
 * Сохранить одно сообщение в chat_memory
 * DEPRECATED: используйте MemoryService.write()
 */
export async function saveMessageToMemory(chatId, role, content, options = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return { ok: true, stored: false, reason: "missing_chatId" };

  if (memory?.config?.enabled) {
    return memory.write({
      chatId: chatIdStr,
      globalUserId: options?.globalUserId || null,
      role,
      content: typeof content === "string" ? content : _toString(content),
      transport: options?.transport || "telegram",
      metadata: options?.metadata || {},
      schemaVersion: options?.schemaVersion || 2,
    });
  }

  return { ok: true, stored: false, reason: "memory_disabled" };
}

/**
 * Сохранить пару user+assistant
 * DEPRECATED: используйте MemoryService.writePair()
 */
export async function saveChatPair(chatId, userText, assistantText, options = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return { ok: true, stored: false, reason: "missing_chatId" };

  if (memory?.config?.enabled) {
    return memory.writePair({
      chatId: chatIdStr,
      globalUserId: options?.globalUserId || null,
      userText: typeof userText === "string" ? userText : _toString(userText),
      assistantText: typeof assistantText === "string" ? assistantText : _toString(assistantText),
      transport: options?.transport || "telegram",
      metadata: options?.metadata || {},
      schemaVersion: options?.schemaVersion || 2,
    });
  }

  return { ok: true, stored: false, reason: "memory_disabled" };
}

export default {
  getChatHistory,
  cleanupChatHistory,
  saveMessageToMemory,
  saveChatPair,
};