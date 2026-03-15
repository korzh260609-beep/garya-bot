// src/sources/sourceService.js
// ============================================================================
// STAGE 10.1 / 10.2 / 10.3 — SourceService Skeleton
// PURPOSE:
// - create a single entry point for future sources layer
// - keep fetch logic OUT of chat handler
// - keep current step non-invasive and fail-open
//
// IMPORTANT:
// - this file does NOT perform real network calls yet
// - this file does NOT require DB yet
// - this file is a service skeleton only
// - current production behavior must remain unchanged until explicit wiring step
// ============================================================================

import { resolveSourceRuntime } from "./sourceRuntime.js";

export const SOURCE_SERVICE_VERSION = "10.3-skeleton-v1";

export const SOURCE_SERVICE_DECISIONS = Object.freeze({
  SKIP: "skip",
  NOOP: "noop",
  READY_FOR_FUTURE_FETCH: "ready_for_future_fetch",
});

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSourceKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAllowedSourceKeys(value) {
  return Array.isArray(value)
    ? value
        .map((item) => normalizeSourceKey(item))
        .filter(Boolean)
    : [];
}

function buildNoSourceResult(reason, runtime = null) {
  return {
    ok: false,
    sourceKey: null,
    content: "",
    fetchedAt: null,
    meta: {
      reason,
      runtimeDecision: runtime?.decision || "unknown",
      runtimeNeedsSource: Boolean(runtime?.needsSource),
      runtimeReason: runtime?.reason || "unknown",
      serviceVersion: SOURCE_SERVICE_VERSION,
    },
  };
}

// ============================================================================
// STAGE 10.1 — default source registry skeleton
// IMPORTANT:
// - hardcoded temporary registry is allowed at skeleton stage
// - real DB-backed sources table can be connected later
// ============================================================================

export function getDefaultSourceRegistry() {
  return [
    {
      key: "html",
      type: "html",
      enabled: false,
      description: "HTML source skeleton",
    },
    {
      key: "rss",
      type: "rss",
      enabled: false,
      description: "RSS source skeleton",
    },
    {
      key: "coingecko_simple_price",
      type: "json_api",
      enabled: false,
      description: "CoinGecko simple price skeleton",
    },
  ];
}

export function getSourceRegistryMap() {
  const registry = getDefaultSourceRegistry();
  const map = new Map();

  for (const item of registry) {
    if (!item || typeof item !== "object") continue;
    const key = normalizeSourceKey(item.key);
    if (!key) continue;
    map.set(key, { ...item, key });
  }

  return map;
}

export function getSourceDefinition(sourceKey) {
  const key = normalizeSourceKey(sourceKey);
  if (!key) return null;

  const map = getSourceRegistryMap();
  return map.get(key) || null;
}

// ============================================================================
// STAGE 10.2 — service plan resolution
// IMPORTANT:
// - this step decides what WOULD happen later
// - but still does not fetch anything
// ============================================================================

export function resolveSourceServicePlan(input = {}) {
  const text = normalizeText(input?.text || "");
  const sourceKey = normalizeSourceKey(input?.sourceKey || "");
  const requireSource = input?.requireSource === true;
  const allowedSourceKeys = normalizeAllowedSourceKeys(input?.allowedSourceKeys || []);

  const runtime = resolveSourceRuntime({
    text,
    sourceKey,
    requireSource,
    sourceResult: input?.sourceResult || null,
    allowedSourceKeys,
  });

  const explicitDefinition = sourceKey ? getSourceDefinition(sourceKey) : null;

  if (runtime.shouldUseSourceResult) {
    return {
      version: SOURCE_SERVICE_VERSION,
      decision: SOURCE_SERVICE_DECISIONS.SKIP,
      runtime,
      shouldFetch: false,
      sourceDefinition: explicitDefinition,
      reason: "runtime_already_has_source_result",
    };
  }

  if (!runtime.needsSource) {
    return {
      version: SOURCE_SERVICE_VERSION,
      decision: SOURCE_SERVICE_DECISIONS.SKIP,
      runtime,
      shouldFetch: false,
      sourceDefinition: explicitDefinition,
      reason: "runtime_does_not_need_source",
    };
  }

  if (sourceKey && !explicitDefinition) {
    return {
      version: SOURCE_SERVICE_VERSION,
      decision: SOURCE_SERVICE_DECISIONS.NOOP,
      runtime,
      shouldFetch: false,
      sourceDefinition: null,
      reason: "explicit_source_key_not_registered",
    };
  }

  return {
    version: SOURCE_SERVICE_VERSION,
    decision: SOURCE_SERVICE_DECISIONS.READY_FOR_FUTURE_FETCH,
    runtime,
    shouldFetch: false,
    sourceDefinition: explicitDefinition,
    reason: sourceKey ? "registered_source_key_but_fetch_not_implemented" : "source_needed_but_fetch_not_implemented",
  };
}

// ============================================================================
// STAGE 10.3 — public service entry point
// IMPORTANT:
// - returns a stable structure now
// - later same method can start real fetch logic
// - chat handler should never own direct source fetch logic
// ============================================================================

export async function resolveSourceContext(input = {}) {
  const plan = resolveSourceServicePlan(input);

  if (plan.runtime?.shouldUseSourceResult) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: true,
      usedExistingSourceResult: true,
      shouldUseSourceResult: true,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: input?.sourceResult || null,
      reason: "existing_source_result_forwarded",
    };
  }

  if (plan.decision === SOURCE_SERVICE_DECISIONS.SKIP) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: true,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: false,
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: buildNoSourceResult(plan.reason, plan.runtime),
      reason: plan.reason,
    };
  }

  if (plan.decision === SOURCE_SERVICE_DECISIONS.NOOP) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: buildNoSourceResult(plan.reason, plan.runtime),
      reason: plan.reason,
    };
  }

  return {
    version: SOURCE_SERVICE_VERSION,
    ok: true,
    usedExistingSourceResult: false,
    shouldUseSourceResult: false,
    shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
    sourceRuntime: plan.runtime,
    sourcePlan: plan,
    sourceResult: buildNoSourceResult(plan.reason, plan.runtime),
    reason: plan.reason,
  };
}

// ============================================================================
// future helper: build diagnostic block for logs / debug prompts
// ============================================================================

export function buildSourceServiceDebugBlock(input = {}) {
  const text = normalizeText(input?.text || "");
  const sourceKey = normalizeSourceKey(input?.sourceKey || "");
  const allowedSourceKeys = normalizeAllowedSourceKeys(input?.allowedSourceKeys || []);
  const plan = resolveSourceServicePlan({
    text,
    sourceKey,
    requireSource: input?.requireSource === true,
    sourceResult: input?.sourceResult || null,
    allowedSourceKeys,
  });

  const lines = [
    "SOURCE SERVICE:",
    `- version: ${SOURCE_SERVICE_VERSION}`,
    `- decision: ${plan.decision}`,
    `- should_fetch: ${plan.shouldFetch ? "true" : "false"}`,
    `- source_definition_found: ${plan.sourceDefinition ? "true" : "false"}`,
    `- source_definition_key: ${plan.sourceDefinition?.key || "none"}`,
    `- runtime_decision: ${plan.runtime?.decision || "unknown"}`,
    `- runtime_needs_source: ${plan.runtime?.needsSource ? "true" : "false"}`,
    `- reason: ${plan.reason}`,
  ];

  return lines.join("\n");
}

export default {
  SOURCE_SERVICE_VERSION,
  SOURCE_SERVICE_DECISIONS,
  getDefaultSourceRegistry,
  getSourceRegistryMap,
  getSourceDefinition,
  resolveSourceServicePlan,
  resolveSourceContext,
  buildSourceServiceDebugBlock,
};