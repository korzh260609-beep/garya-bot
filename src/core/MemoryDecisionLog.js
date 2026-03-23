// src/core/MemoryDecisionLog.js
// MEMORY CLASSIFIER V2 — DECISION LOG SKELETON
//
// Goal:
// - keep classification reasoning structured
// - no DB yet
// - no side effects
// - can be attached to diagnostics / shadow mode later

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildMemoryDecisionLog({
  input = "",
  normalizedInput = "",
  strategy = "rules_first",
  matchedRule = null,
  legacyResult = null,
  finalResult = null,
  notes = [],
} = {}) {
  return {
    input: safeStr(input),
    normalizedInput: safeStr(normalizedInput),
    strategy: safeStr(strategy) || "rules_first",
    matchedRule: matchedRule
      ? {
          id: safeStr(matchedRule.id),
          targetKey: safeStr(matchedRule.targetKey),
          targetType: safeStr(matchedRule.targetType),
        }
      : null,
    legacyResult: legacyResult
      ? {
          key: safeStr(legacyResult.key),
          value: safeStr(legacyResult.value),
        }
      : null,
    finalResult: finalResult
      ? {
          key: safeStr(finalResult.key),
          rememberType: safeStr(finalResult.rememberType),
          value: safeStr(finalResult.value),
          source: safeStr(finalResult.source),
        }
      : null,
    notes: safeArray(notes).map((x) => safeStr(x)).filter(Boolean),
    createdAt: new Date().toISOString(),
  };
}

export default buildMemoryDecisionLog;