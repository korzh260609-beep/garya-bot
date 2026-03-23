// src/core/memoryClassifierV2Config.js
// MEMORY CLASSIFIER V2 — CONFIG SKELETON
//
// Goal:
// - no business logic
// - no DB
// - no AI calls
// - only flags / limits / strategy
// - safe to add before runtime wiring

function envTruthy(v) {
  if (v === true) return true;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function envInt(v, fallback, min = 0, max = 100000) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function getMemoryClassifierV2Config() {
  return {
    enabled: envTruthy(process.env.MEMORY_CLASSIFIER_V2_ENABLED),
    mode: String(process.env.MEMORY_CLASSIFIER_V2_MODE || "shadow").trim() || "shadow",

    // Strategy:
    // - "legacy_only"       -> use only current explicitRememberKey.js logic
    // - "rules_first"       -> rules catalog first, then legacy fallback
    // - "semantic_reserved" -> reserved for future semantic/AI layer
    strategy:
      String(process.env.MEMORY_CLASSIFIER_V2_STRATEGY || "rules_first").trim() || "rules_first",

    maxTextLength: envInt(process.env.MEMORY_CLASSIFIER_V2_MAX_TEXT_LENGTH, 2000, 64, 10000),
    maxDecisionLogItems: envInt(process.env.MEMORY_CLASSIFIER_V2_MAX_DECISION_LOG_ITEMS, 20, 1, 200),

    // Reserved for future:
    semanticProvider: String(process.env.MEMORY_CLASSIFIER_V2_SEMANTIC_PROVIDER || "").trim() || null,
    semanticModel: String(process.env.MEMORY_CLASSIFIER_V2_SEMANTIC_MODEL || "").trim() || null,
  };
}

export default getMemoryClassifierV2Config;