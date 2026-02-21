// src/bot/memory/memoryBridge.js
// STAGE 7 — MEMORY LAYER V1
// Bridge to keep backward compatibility while moving chat pipeline to MemoryService.
// 1) If MEMORY_ENABLED=1 -> route calls via MemoryService
// 2) Else -> fallback to legacy chatMemory.js

import { getMemoryService } from "../../core/memoryServiceFactory.js";
import {
  getChatHistory as legacyGetChatHistory,
  saveMessageToMemory as legacySaveMessageToMemory,
  saveChatPair as legacySaveChatPair,
} from "../../memory/chatMemory.js";

function _toString(x) {
  if (x === null || x === undefined) return "";
  return String(x);
}

export async function getChatHistory(chatId, limit, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (memory?.config?.enabled && chatIdStr) {
    return memory.recent({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      limit,
    });
  }

  return legacyGetChatHistory(chatIdStr, limit, opts);
}

export async function saveMessageToMemory(chatId, role, content, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (memory?.config?.enabled && chatIdStr) {
    return memory.write({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      role,
      content: typeof content === "string" ? content : _toString(content),
      transport: opts?.transport || "telegram",
      metadata: opts?.metadata || {},
      schemaVersion: opts?.schemaVersion || 1,
    });
  }

  return legacySaveMessageToMemory(chatIdStr, role, content, opts);
}

export async function saveChatPair(chatId, userText, assistantText, opts = {}) {
  const chatIdStr = _toString(chatId);
  const memory = getMemoryService();

  if (memory?.config?.enabled && chatIdStr) {
    return memory.writePair({
      chatId: chatIdStr,
      globalUserId: opts?.globalUserId || null,
      userText: typeof userText === "string" ? userText : _toString(userText),
      assistantText:
        typeof assistantText === "string" ? assistantText : _toString(assistantText),
      transport: opts?.transport || "telegram",
      metadata: opts?.metadata || {},
      schemaVersion: opts?.schemaVersion || 1,
    });
  }

  return legacySaveChatPair(chatIdStr, userText, assistantText, opts);
}

export default {
  getChatHistory,
  saveMessageToMemory,
  saveChatPair,
};
