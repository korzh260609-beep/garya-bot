// src/core/memoryCanonicalizer.js
// MEMORY CLASSIFIER V2 — CANONICALIZER SKELETON
//
// Goal:
// - normalize text deterministically
// - apply catalog canonical values when present
// - keep value logic OUTSIDE legacy classifier when possible
// - no DB
// - no side effects

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function oneLine(value) {
  return safeStr(value).replace(/\s+/g, " ").trim();
}

export function normalizeMemoryCandidateText(value) {
  return oneLine(value);
}

export function canonicalizeMemoryValue({
  rawValue,
  matchedRule = null,
} = {}) {
  const raw = normalizeMemoryCandidateText(rawValue);

  if (matchedRule && typeof matchedRule.canonicalValue === "string" && matchedRule.canonicalValue.trim()) {
    return matchedRule.canonicalValue.trim();
  }

  return raw;
}

export default canonicalizeMemoryValue;