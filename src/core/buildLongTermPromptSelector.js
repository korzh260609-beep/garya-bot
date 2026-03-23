// src/core/buildLongTermPromptSelector.js
//
// Goal:
// - define deterministic long-term memory selector for prompt retrieval
// - keep selection policy OUTSIDE bridges/prompts
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT read memory by itself
// - this helper does NOT call MemoryService
// - this helper only returns selector config for selectLongTermContext()

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeStrList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();

  for (const item of values) {
    const s = safeStr(item).trim();
    if (!s) continue;

    const dedupeKey = s.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    out.push(s);
  }

  return out;
}

export function buildLongTermPromptSelector({
  rememberKeys = null,
  rememberTypes = null,
  perKeyLimit = null,
  perTypeLimit = null,
  totalLimit = null,
} = {}) {
  const defaultRememberKeys = normalizeStrList([
    "name",
    "communication_style",
  ]);

  const defaultRememberTypes = normalizeStrList([
    "identity_profile",
    "user_preference",
  ]);

  const finalRememberKeys =
    Array.isArray(rememberKeys) && rememberKeys.length > 0
      ? normalizeStrList(rememberKeys)
      : defaultRememberKeys;

  const finalRememberTypes =
    Array.isArray(rememberTypes) && rememberTypes.length > 0
      ? normalizeStrList(rememberTypes)
      : defaultRememberTypes;

  const finalPerKeyLimit =
    Number.isFinite(Number(perKeyLimit)) && Number(perKeyLimit) > 0
      ? Math.trunc(Number(perKeyLimit))
      : 2;

  const finalPerTypeLimit =
    Number.isFinite(Number(perTypeLimit)) && Number(perTypeLimit) > 0
      ? Math.trunc(Number(perTypeLimit))
      : 2;

  const finalTotalLimit =
    Number.isFinite(Number(totalLimit)) && Number(totalLimit) > 0
      ? Math.trunc(Number(totalLimit))
      : 4;

  return {
    rememberKeys: finalRememberKeys,
    rememberTypes: finalRememberTypes,
    perKeyLimit: finalPerKeyLimit,
    perTypeLimit: finalPerTypeLimit,
    totalLimit: finalTotalLimit,
  };
}

export default buildLongTermPromptSelector;