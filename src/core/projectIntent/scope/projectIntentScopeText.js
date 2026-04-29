// src/core/projectIntent/scope/projectIntentScopeText.js
// ============================================================================
// LEGACY PROJECT INTENT SCOPE MARKER
//
// INTERFACE MODE NOTE:
// - This module is part of the old projectIntent scope classifier.
// - It uses deterministic phrase/token/prefix/path signals.
// - Under hard Human Mode / Technical Mode separation, this is NOT full Human Mode.
// - Treat this as legacy Technical Mode support until a clean structured meaning
//   layer replaces it.
// - Do not add new phrase-bound hacks here.
// ============================================================================

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>/\\|"'\`~@#$%^&*+=-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

export function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

export function countHits(...groups) {
  let count = 0;
  for (const group of groups) {
    count += Array.isArray(group) ? group.length : 0;
  }
  return count;
}

export default {
  normalizeText,
  tokenizeText,
  unique,
  countHits,
};
