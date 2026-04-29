// src/core/projectIntent/scope/projectIntentScopePath.js
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

import { unique } from "./projectIntentScopeText.js";

export function extractPathLikeObjects(text = "") {
  const raw = String(text || "");
  const hits = [];

  const rx = /\b([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\/?|[A-Za-z0-9_.-]+\.[A-Za-z0-9]{1,8})\b/g;
  let m;

  while ((m = rx.exec(raw)) !== null) {
    const value = String(m[1] || "").trim();
    if (!value) continue;
    if (value.length < 2) continue;
    hits.push(value);
  }

  return unique(hits);
}

export function looksLikeRepoPath(value = "") {
  const v = String(value || "").trim();
  if (!v) return false;
  if (v.includes("/")) return true;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return true;
  return false;
}

export function hasLikelyRepoPath(values = []) {
  return (Array.isArray(values) ? values : []).some((v) => looksLikeRepoPath(v));
}

export default {
  extractPathLikeObjects,
  looksLikeRepoPath,
  hasLikelyRepoPath,
};
