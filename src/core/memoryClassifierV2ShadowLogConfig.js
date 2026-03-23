// src/core/memoryClassifierV2ShadowLogConfig.js
// MEMORY CLASSIFIER V2 — SHADOW LOG CONFIG
//
// Goal:
// - keep shadow logging policy OUTSIDE handleExplicitRemember.js
// - deterministic only
// - no DB
// - no side effects
//
// IMPORTANT:
// - affects logging only
// - does NOT affect memory saving logic
// - does NOT affect safe adoption logic

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function envTruthy(value, fallback = false) {
  const normalized = safeStr(value).trim().toLowerCase();

  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }

  return fallback;
}

function normalizeMode(value, fallback = "compact") {
  const normalized = safeStr(value).trim().toLowerCase();

  if (normalized === "compact") return "compact";
  if (normalized === "full") return "full";
  if (normalized === "off") return "off";

  return fallback;
}

export function getMemoryClassifierV2ShadowLogConfig() {
  return {
    enabled: envTruthy(process.env.MEMORY_CLASSIFIER_V2_SHADOW_LOG_ENABLED, true),
    mode: normalizeMode(process.env.MEMORY_CLASSIFIER_V2_SHADOW_LOG_MODE, "compact"),
  };
}

export default getMemoryClassifierV2ShadowLogConfig;