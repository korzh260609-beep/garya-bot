// src/bot/handlers/chat/intent/resolveChatIntent.js
//
// Goal:
// - introduce intent resolver contract WITHOUT building architecture on keywords
// - current stage: safe skeleton only
// - prefer "normal" over false certainty
// - clarification is allowed when future resolver cannot understand meaning
//
// IMPORTANT:
// - no DB
// - no AI
// - no side effects
// - this file is NOT a semantic engine yet
// - this file is a contract-safe entrypoint for future understanding layer

import {
  CHAT_INTENT_MODE,
  CHAT_INTENT_DOMAIN,
  createChatIntentResult,
} from "./chatIntentTypes.js";

function safeText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeText(value).trim();
}

export function resolveChatIntent(input = {}) {
  const text =
    typeof input === "string"
      ? input
      : typeof input?.text === "string"
        ? input.text
        : typeof input?.effective === "string"
          ? input.effective
          : "";

  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return createChatIntentResult({
      mode: CHAT_INTENT_MODE.NORMAL,
      domain: CHAT_INTENT_DOMAIN.UNKNOWN,
      candidateSlots: [],
      confidence: 0,
      meta: {
        reason: "empty_text",
      },
    });
  }

  // IMPORTANT:
  // Current stage intentionally does NOT pretend to understand meaning
  // from words/phrases.
  //
  // We only define the resolver output contract now.
  // Future stage may plug in:
  // - semantic classifier
  // - hybrid resolver
  // - context-aware resolver
  // - clarification-first policy
  //
  // For now we return NORMAL unless a future resolver explicitly sets
  // stable_fact / needs_clarification with justified confidence.

  return createChatIntentResult({
    mode: CHAT_INTENT_MODE.NORMAL,
    domain: CHAT_INTENT_DOMAIN.UNKNOWN,
    candidateSlots: [],
    confidence: 0.15,
    meta: {
      reason: "skeleton_only_no_semantic_resolution_yet",
    },
  });
}

export default resolveChatIntent;
