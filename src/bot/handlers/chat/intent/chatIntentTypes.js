// src/bot/handlers/chat/intent/chatIntentTypes.js
//
// Goal:
// - define stable intent contract for chat understanding
// - no keyword logic here
// - no DB
// - no side effects
//
// IMPORTANT:
// - this is a CONTRACT/SKELETON layer
// - real resolver logic will be added later
// - current stage: structure first, not semantic engine yet

export const CHAT_INTENT_MODE = Object.freeze({
  NORMAL: "normal",
  STABLE_FACT: "stable_fact",
  NEEDS_CLARIFICATION: "needs_clarification",
});

export const CHAT_INTENT_DOMAIN = Object.freeze({
  UNKNOWN: "unknown",
  IDENTITY: "identity",
  USER_PREFERENCE: "user_preference",
  VEHICLE_PROFILE: "vehicle_profile",
  VEHICLE_MAINTENANCE: "vehicle_maintenance",
  TASK: "task",
  GENERAL: "general",
});

export function normalizeIntentMode(value) {
  const v = typeof value === "string" ? value.trim() : "";
  return Object.values(CHAT_INTENT_MODE).includes(v)
    ? v
    : CHAT_INTENT_MODE.NORMAL;
}

export function normalizeIntentDomain(value) {
  const v = typeof value === "string" ? value.trim() : "";
  return Object.values(CHAT_INTENT_DOMAIN).includes(v)
    ? v
    : CHAT_INTENT_DOMAIN.UNKNOWN;
}

export function normalizeCandidateSlots(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s =
      typeof item === "string"
        ? item.trim()
        : item === null || item === undefined
          ? ""
          : String(item).trim();

    if (!s) continue;

    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  return out;
}

export function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function createChatIntentResult({
  mode = CHAT_INTENT_MODE.NORMAL,
  domain = CHAT_INTENT_DOMAIN.UNKNOWN,
  candidateSlots = [],
  confidence = 0,
  clarificationQuestion = null,
  meta = {},
} = {}) {
  return {
    mode: normalizeIntentMode(mode),
    domain: normalizeIntentDomain(domain),
    candidateSlots: normalizeCandidateSlots(candidateSlots),
    confidence: normalizeConfidence(confidence),
    clarificationQuestion:
      typeof clarificationQuestion === "string" &&
      clarificationQuestion.trim()
        ? clarificationQuestion.trim()
        : null,
    meta:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? meta
        : {},
  };
}

export function isStableFactIntent(intent) {
  return intent?.mode === CHAT_INTENT_MODE.STABLE_FACT;
}

export function needsClarificationIntent(intent) {
  return intent?.mode === CHAT_INTENT_MODE.NEEDS_CLARIFICATION;
}
