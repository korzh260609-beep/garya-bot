// src/core/memoryClassifierV2AdoptionConfig.js
// MEMORY CLASSIFIER V2 — SAFE ADOPTION CONFIG
//
// Goal:
// - keep safe-adoption allowlist OUTSIDE handleExplicitRemember.js
// - deterministic only
// - no DB
// - no side effects
// - current stage: only proven-safe runtime adoption keys
//
// IMPORTANT:
// - this config controls ONLY partial runtime adoption
// - shadow mode remains independent
// - do NOT add risky keys here without verification

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeKey(value) {
  return safeStr(value).trim();
}

function normalizeList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();

  for (const item of values) {
    const key = normalizeKey(item);
    if (!key) continue;

    const dedupeKey = key.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    out.push(key);
  }

  return out;
}

const MEMORY_CLASSIFIER_V2_SAFE_ADOPTION_KEYS = Object.freeze(
  normalizeList([
    // VERIFIED SAFE:
    "name",

    // NOT SAFE YET:
    // "communication_style",
  ])
);

export function getMemoryClassifierV2SafeAdoptionKeys() {
  return MEMORY_CLASSIFIER_V2_SAFE_ADOPTION_KEYS;
}

export function isMemoryClassifierV2SafeAdoptionKey(key) {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return false;

  return MEMORY_CLASSIFIER_V2_SAFE_ADOPTION_KEYS.includes(normalizedKey);
}

export default getMemoryClassifierV2SafeAdoptionKeys;