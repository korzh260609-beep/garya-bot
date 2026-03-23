// src/core/memoryClassifierV2RuntimeDecision.js
// MEMORY CLASSIFIER V2 — RUNTIME DECISION LAYER
//
// Goal:
// - move runtime decision logic OUT of handleExplicitRemember.js
// - keep behavior identical
// - keep deterministic only
// - no DB
// - no side effects except shadow logging
//
// IMPORTANT:
// - this module does NOT classify text itself
// - this module does NOT save memory
// - this module decides:
//   1) whether shadow should run
//   2) how shadow should be logged
//   3) whether safe adoption is allowed
//   4) which remember plan should be selected

import { getMemoryClassifierV2Config } from "./memoryClassifierV2Config.js";
import { isMemoryClassifierV2SafeAdoptionKey } from "./memoryClassifierV2AdoptionConfig.js";
import { getMemoryClassifierV2ShadowLogConfig } from "./memoryClassifierV2ShadowLogConfig.js";

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function getMemoryClassifierV2RuntimeConfig() {
  try {
    const config = getMemoryClassifierV2Config();
    return {
      enabled: config?.enabled === true,
      mode: String(config?.mode || "").trim() || "shadow",
    };
  } catch (_e) {
    return {
      enabled: false,
      mode: "shadow",
    };
  }
}

export function shouldRunMemoryClassifierV2Shadow(runtimeConfig) {
  return runtimeConfig?.enabled === true;
}

export function shouldAllowMemoryClassifierV2Adoption(runtimeConfig) {
  return (
    runtimeConfig?.enabled === true &&
    String(runtimeConfig?.mode || "").trim() === "hybrid_safe_keys"
  );
}

export function isSafeV2AdoptionCandidate(v2Result) {
  const key = safeStr(v2Result?.result?.key).trim();
  const value = safeStr(v2Result?.result?.value).trim();

  if (!key || !value) {
    return false;
  }

  return isMemoryClassifierV2SafeAdoptionKey(key);
}

export function buildShadowComparison({
  rememberRawValue,
  legacyKey,
  legacyValue,
  v2Result,
}) {
  const v2Final = v2Result?.result || {};

  return {
    input: safeStr(rememberRawValue),
    legacy: {
      key: safeStr(legacyKey),
      value: safeStr(legacyValue),
    },
    v2: {
      ok: v2Result?.ok === true,
      reason: safeStr(v2Result?.reason),
      key: safeStr(v2Final?.key),
      rememberType: safeStr(v2Final?.rememberType),
      value: safeStr(v2Final?.value),
      source: safeStr(v2Final?.source),
    },
    mismatch: {
      key: safeStr(legacyKey) !== safeStr(v2Final?.key),
      value: safeStr(legacyValue) !== safeStr(v2Final?.value),
    },
    decisionLog: v2Result?.decisionLog || null,
  };
}

export function buildCompactShadowLogPayload(payload) {
  return {
    input: safeStr(payload?.input),
    legacy: {
      key: safeStr(payload?.legacy?.key),
      value: safeStr(payload?.legacy?.value),
    },
    v2: {
      ok: payload?.v2?.ok === true,
      reason: safeStr(payload?.v2?.reason),
      key: safeStr(payload?.v2?.key),
      rememberType: safeStr(payload?.v2?.rememberType),
      value: safeStr(payload?.v2?.value),
      source: safeStr(payload?.v2?.source),
    },
    mismatch: {
      key: payload?.mismatch?.key === true,
      value: payload?.mismatch?.value === true,
    },
  };
}

export function logMemoryClassifierV2Shadow(payload) {
  const logConfig = getMemoryClassifierV2ShadowLogConfig();

  if (logConfig?.enabled !== true) {
    return;
  }

  if (String(logConfig?.mode || "").trim() === "off") {
    return;
  }

  const hasMismatch =
    payload?.mismatch?.key === true || payload?.mismatch?.value === true;

  const finalPayload =
    String(logConfig?.mode || "").trim() === "full"
      ? payload
      : buildCompactShadowLogPayload(payload);

  if (hasMismatch) {
    console.warn("[MEMORY_CLASSIFIER_V2_SHADOW_MISMATCH]", finalPayload);
    return;
  }

  console.log("[MEMORY_CLASSIFIER_V2_SHADOW_MATCH]", finalPayload);
}

export function buildRememberPlan({
  legacyKey,
  legacyValue,
  v2Result,
  runtimeConfig,
}) {
  const legacyPlan = {
    rememberKey: safeStr(legacyKey).trim(),
    rememberValue: safeStr(legacyValue).trim(),
    selectedBy: "legacy",
  };

  if (!shouldAllowMemoryClassifierV2Adoption(runtimeConfig)) {
    return legacyPlan;
  }

  if (v2Result?.ok !== true) {
    return legacyPlan;
  }

  if (!isSafeV2AdoptionCandidate(v2Result)) {
    return legacyPlan;
  }

  const v2Key = safeStr(v2Result?.result?.key).trim();
  const v2Value = safeStr(v2Result?.result?.value).trim();

  if (!v2Key || !v2Value) {
    return legacyPlan;
  }

  return {
    rememberKey: v2Key,
    rememberValue: v2Value,
    selectedBy: "v2_safe_adoption",
  };
}

export default {
  getMemoryClassifierV2RuntimeConfig,
  shouldRunMemoryClassifierV2Shadow,
  shouldAllowMemoryClassifierV2Adoption,
  isSafeV2AdoptionCandidate,
  buildShadowComparison,
  buildCompactShadowLogPayload,
  logMemoryClassifierV2Shadow,
  buildRememberPlan,
};