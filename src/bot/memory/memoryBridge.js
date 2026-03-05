// src/bot/memory/memoryBridge.js
// STAGE 7 — MEMORY LAYER V1
// Bridge: single path via MemoryService ONLY.
// - No legacy fallback to src/memory/chatMemory.js (Stage 7 rule).
// - If memory disabled -> no-op (safe).

import { getMemoryService } from "../../core/memoryServiceFactory.js";

function _toString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

export async function getChatHistory(chatId, limit, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return [];

  // Only MemoryService path
  if (memory?.config?.enabled) {
    return memory.recent({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      limit,
    });
  }

  // memory disabled -> return empty
  return [];
}

export async function saveMessageToMemory(chatId, role, content, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return { ok: true, stored: false, reason: "missing_chatId" };

  // Only MemoryService path
  if (memory?.config?.enabled) {
    return memory.write({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      role,
      content: typeof content === "string" ? content : _toString(content),
      transport: opts?.transport || "telegram",
      metadata: opts?.metadata || {},
      schemaVersion: opts?.schemaVersion || 2,
    });
  }

  // memory disabled -> no-op
  return { ok: true, stored: false, reason: "memory_disabled" };
}

export async function saveChatPair(chatId, userText, assistantText, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (!chatIdStr) return { ok: true, stored: false, reason: "missing_chatId" };

  // Only MemoryService path
  if (memory?.config?.enabled) {
    return memory.writePair({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      userText: typeof userText === "string" ? userText : _toString(userText),
      assistantText:
        typeof assistantText === "string" ? assistantText : _toString(assistantText),
      transport: opts?.transport || "telegram",
      metadata: opts?.metadata || {},
      schemaVersion: opts?.schemaVersion || 2,
    });
  }

  // memory disabled -> no-op
  return { ok: true, stored: false, reason: "memory_disabled" };
}

export default {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
};