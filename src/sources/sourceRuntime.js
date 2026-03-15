// src/sources/sourceRuntime.js
// ============================================================================
// STAGE 10.1 / 10.2 / 10.3 — Sources Runtime Skeleton
// PURPOSE:
// - create a safe runtime contract for future source-first flow
// - do NOT change production behavior yet
// - do NOT fetch remote sources yet
// - do NOT require DB / ENV / router rewiring yet
// - this file is foundation only
//
// IMPORTANT:
// - source-first must be real runtime, not prompt fiction
// - but this step is skeleton only
// - current production remains AI-first unless explicit source result is passed
// - no hidden activation
// ============================================================================

export const SOURCE_RUNTIME_VERSION = "10.3-skeleton-v1";

export const SOURCE_RUNTIME_DECISIONS = Object.freeze({
  SKIP: "skip",
  USE_SOURCE_RESULT: "use_source_result",
  REQUIRE_SOURCE_RESULT: "require_source_result",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSourceKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeBoolean(value) {
  return value === true;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

// ============================================================================
// STAGE 10.1 — detect whether the user request is likely factual/current/source-like
// IMPORTANT:
// - skeleton heuristic only
// - must remain conservative
// - must NOT pretend that source is available
// ============================================================================

export function detectSourceNeedFromText(text = "") {
  const t = normalizeText(text).toLowerCase();

  if (!t) {
    return {
      needsSource: false,
      reason: "empty_text",
      matchedSignals: [],
      confidence: "low",
    };
  }

  const highSignals = [
    "цена",
    "курс",
    "price",
    "market cap",
    "капитализация",
    "новости",
    "news",
    "сегодня",
    "today",
    "сейчас",
    "now",
    "актуаль",
    "latest",
    "последн",
    "current",
    "провер",
    "verify",
    "source",
    "источник",
    "coingecko",
    "rss",
    "html",
    "btc",
    "eth",
    "usdt",
    "coin",
    "монета",
  ];

  const matchedSignals = [];
  for (const signal of highSignals) {
    if (t.includes(signal)) {
      matchedSignals.push(signal);
    }
  }

  if (matchedSignals.length >= 2) {
    return {
      needsSource: true,
      reason: "matched_multiple_source_signals",
      matchedSignals,
      confidence: "high",
    };
  }

  if (matchedSignals.length === 1) {
    return {
      needsSource: true,
      reason: "matched_single_source_signal",
      matchedSignals,
      confidence: "medium",
    };
  }

  return {
    needsSource: false,
    reason: "no_source_signals",
    matchedSignals: [],
    confidence: "low",
  };
}

// ============================================================================
// STAGE 10.2 — runtime contract for already-fetched source result
// IMPORTANT:
// - this step does NOT fetch anything by itself
// - it only validates a source result object if one is explicitly provided
// ============================================================================

export function normalizeSourceResult(sourceResult = null) {
  if (!sourceResult || typeof sourceResult !== "object") {
    return {
      hasSourceResult: false,
      sourceKey: null,
      content: "",
      meta: {},
      fetchedAt: null,
      ok: false,
      reason: "no_source_result",
    };
  }

  const sourceKey = normalizeSourceKey(sourceResult.sourceKey);
  const content = typeof sourceResult.content === "string" ? sourceResult.content.trim() : "";
  const fetchedAt =
    typeof sourceResult.fetchedAt === "string" && sourceResult.fetchedAt.trim()
      ? sourceResult.fetchedAt.trim()
      : null;

  const meta = sourceResult.meta && typeof sourceResult.meta === "object" ? sourceResult.meta : {};
  const ok = normalizeBoolean(sourceResult.ok) || Boolean(sourceKey && content);

  return {
    hasSourceResult: Boolean(sourceKey && content),
    sourceKey: sourceKey || null,
    content,
    meta,
    fetchedAt,
    ok,
    reason: sourceKey && content ? "valid_source_result" : "invalid_source_result_shape",
  };
}

// ============================================================================
// STAGE 10.3 — final runtime decision
// IMPORTANT:
// - explicit source result wins
// - detected need without real source result must NOT fake source-first
// - this file does NOT block AI by itself yet
// - blocking policy can be added later, after config/wiring
// ============================================================================

export function resolveSourceRuntime(input = {}) {
  const text = normalizeText(input?.text || "");
  const requestedSourceKey = normalizeSourceKey(input?.sourceKey || "");
  const requireSource = normalizeBoolean(input?.requireSource);
  const allowedSourceKeys = normalizeArray(input?.allowedSourceKeys).map((x) =>
    normalizeSourceKey(x)
  );

  const sourceNeed = detectSourceNeedFromText(text);
  const sourceResult = normalizeSourceResult(input?.sourceResult || null);

  const sourceKeyAllowed =
    !sourceResult.sourceKey ||
    allowedSourceKeys.length === 0 ||
    allowedSourceKeys.includes(sourceResult.sourceKey);

  if (sourceResult.hasSourceResult && sourceKeyAllowed) {
    return {
      version: SOURCE_RUNTIME_VERSION,
      decision: SOURCE_RUNTIME_DECISIONS.USE_SOURCE_RESULT,
      needsSource: true,
      shouldUseSourceResult: true,
      shouldRequireSourceResult: false,
      sourceKey: sourceResult.sourceKey,
      sourceResult,
      sourceNeed,
      reason: "real_source_result_available",
    };
  }

  if (sourceResult.hasSourceResult && !sourceKeyAllowed) {
    return {
      version: SOURCE_RUNTIME_VERSION,
      decision: SOURCE_RUNTIME_DECISIONS.SKIP,
      needsSource: sourceNeed.needsSource,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: false,
      sourceKey: sourceResult.sourceKey,
      sourceResult,
      sourceNeed,
      reason: "source_result_not_allowed",
    };
  }

  if (requireSource || requestedSourceKey || sourceNeed.needsSource) {
    return {
      version: SOURCE_RUNTIME_VERSION,
      decision: SOURCE_RUNTIME_DECISIONS.REQUIRE_SOURCE_RESULT,
      needsSource: true,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: true,
      sourceKey: requestedSourceKey || null,
      sourceResult,
      sourceNeed,
      reason: requireSource
        ? "explicit_require_source"
        : requestedSourceKey
          ? "explicit_source_key_without_result"
          : "detected_source_need_without_result",
    };
  }

  return {
    version: SOURCE_RUNTIME_VERSION,
    decision: SOURCE_RUNTIME_DECISIONS.SKIP,
    needsSource: false,
    shouldUseSourceResult: false,
    shouldRequireSourceResult: false,
    sourceKey: null,
    sourceResult,
    sourceNeed,
    reason: "no_source_needed",
  };
}

// ============================================================================
// prompt helper for future safe transparency
// IMPORTANT:
// - not wired automatically yet
// - can be injected later into system/user message context
// ============================================================================

export function buildSourceRuntimePromptBlock(input = {}) {
  const resolved = resolveSourceRuntime(input);

  const lines = [
    "SOURCE RUNTIME:",
    `- version: ${resolved.version}`,
    `- decision: ${resolved.decision}`,
    `- needs_source: ${resolved.needsSource ? "true" : "false"}`,
    `- should_use_source_result: ${resolved.shouldUseSourceResult ? "true" : "false"}`,
    `- should_require_source_result: ${resolved.shouldRequireSourceResult ? "true" : "false"}`,
    `- source_key: ${resolved.sourceKey || "none"}`,
    `- reason: ${resolved.reason}`,
  ];

  if (resolved.sourceNeed?.matchedSignals?.length) {
    lines.push(`- matched_signals: ${resolved.sourceNeed.matchedSignals.join(", ")}`);
  }

  if (resolved.sourceResult?.hasSourceResult) {
    lines.push(`- source_result_ok: ${resolved.sourceResult.ok ? "true" : "false"}`);
    lines.push(`- source_result_fetched_at: ${resolved.sourceResult.fetchedAt || "unknown"}`);
  } else {
    lines.push("- source_result_ok: false");
    lines.push("- source_result_fetched_at: none");
  }

  lines.push("");
  lines.push("RULES:");
  lines.push("- never claim that a source was used unless a real source result exists in runtime");
  lines.push("- if source is needed but no source result exists, be explicit about that");
  lines.push("- source-first requires real fetched data, not prompt wording");
  lines.push("- this block does not fetch sources by itself");

  return lines.join("\n");
}

export default {
  SOURCE_RUNTIME_VERSION,
  SOURCE_RUNTIME_DECISIONS,
  detectSourceNeedFromText,
  normalizeSourceResult,
  resolveSourceRuntime,
  buildSourceRuntimePromptBlock,
};