// src/core/buildLongTermMemoryPromptBridge.js
// STAGE 11+ — deterministic bridge:
// MemoryService.selectLongTermContext(...) -> formatSelectedMemoryForPrompt(...)
////
//// GOAL:
//// - prepare long-term memory block for future prompt assembly
//// - NO AI
//// - NO router changes
//// - NO response-flow activation
//// - deterministic only
//// - fail-open
////
//// IMPORTANT:
//// - this helper does NOT inject anything into chat flow by itself
//// - this helper only builds a ready prompt-safe block
//// - future activation into handlers/chat.js must be a separate explicit step

import { getMemoryService } from "./memoryServiceFactory.js";
import formatSelectedMemoryForPrompt from "./formatSelectedMemoryForPrompt.js";

function _safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function _normalizeInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _normalizeStrList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = _safeStr(item).trim();
    if (!s) continue;

    const key = s.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(s);
  }

  return out;
}

export async function buildLongTermMemoryPromptBridge({
  globalUserId = null,
  chatId = null,

  rememberTypes = [],
  rememberKeys = [],

  perTypeLimit = 3,
  perKeyLimit = 3,
  totalLimit = 12,

  header = "LONG_TERM_MEMORY",
  maxItems = 12,
  maxValueLength = 240,

  memoryService = null,
} = {}) {
  const chatIdStr = chatId ? String(chatId) : null;
  const safeRememberTypes = _normalizeStrList(rememberTypes);
  const safeRememberKeys = _normalizeStrList(rememberKeys);

  const safePerTypeLimit = _normalizeInt(perTypeLimit, 3, 1, 50);
  const safePerKeyLimit = _normalizeInt(perKeyLimit, 3, 1, 50);
  const safeTotalLimit = _normalizeInt(totalLimit, 12, 1, 100);

  const safeMaxItems = _normalizeInt(maxItems, 12, 1, 100);
  const safeMaxValueLength = _normalizeInt(maxValueLength, 240, 16, 2000);

  if (!chatIdStr) {
    return {
      ok: false,
      chatId: null,
      globalUserId: globalUserId ? String(globalUserId) : null,
      block: "",
      items: [],
      total: 0,
      reason: "missing_chatId",
    };
  }

  if (safeRememberTypes.length === 0 && safeRememberKeys.length === 0) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId ? String(globalUserId) : null,
      block: "",
      items: [],
      total: 0,
      reason: "empty_selector",
    };
  }

  const memory = memoryService || getMemoryService();

  if (!memory || typeof memory.selectLongTermContext !== "function") {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId ? String(globalUserId) : null,
      block: "",
      items: [],
      total: 0,
      reason: "memory_service_unavailable",
    };
  }

  try {
    const selected = await memory.selectLongTermContext({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      rememberTypes: safeRememberTypes,
      rememberKeys: safeRememberKeys,
      perTypeLimit: safePerTypeLimit,
      perKeyLimit: safePerKeyLimit,
      totalLimit: safeTotalLimit,
    });

    if (!selected || selected.ok !== true) {
      return {
        ok: false,
        chatId: chatIdStr,
        globalUserId: globalUserId ? String(globalUserId) : null,
        block: "",
        items: [],
        total: 0,
        rememberTypes: safeRememberTypes,
        rememberKeys: safeRememberKeys,
        limits: {
          perTypeLimit: safePerTypeLimit,
          perKeyLimit: safePerKeyLimit,
          totalLimit: safeTotalLimit,
          maxItems: safeMaxItems,
          maxValueLength: safeMaxValueLength,
        },
        reason: selected?.reason || "select_long_term_context_failed",
      };
    }

    const items = Array.isArray(selected.items) ? selected.items : [];

    const block = formatSelectedMemoryForPrompt({
      items,
      header,
      maxItems: safeMaxItems,
      maxValueLength: safeMaxValueLength,
    });

    return {
      ok: true,
      chatId: chatIdStr,
      globalUserId: globalUserId ? String(globalUserId) : null,
      block: typeof block === "string" ? block : "",
      items,
      total: items.length,
      rememberTypes: safeRememberTypes,
      rememberKeys: safeRememberKeys,
      limits: {
        perTypeLimit: safePerTypeLimit,
        perKeyLimit: safePerKeyLimit,
        totalLimit: safeTotalLimit,
        maxItems: safeMaxItems,
        maxValueLength: safeMaxValueLength,
      },
      reason: items.length > 0 ? "memory_prompt_block_built" : "no_selected_items",
    };
  } catch (e) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId ? String(globalUserId) : null,
      block: "",
      items: [],
      total: 0,
      rememberTypes: safeRememberTypes,
      rememberKeys: safeRememberKeys,
      limits: {
        perTypeLimit: safePerTypeLimit,
        perKeyLimit: safePerKeyLimit,
        totalLimit: safeTotalLimit,
        maxItems: safeMaxItems,
        maxValueLength: safeMaxValueLength,
      },
      reason: "build_long_term_memory_prompt_bridge_failed",
      error: e?.message || String(e),
    };
  }
}

export default buildLongTermMemoryPromptBridge;