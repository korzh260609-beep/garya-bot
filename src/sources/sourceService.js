// src/sources/sourceService.js
// ============================================================================
// STAGE 10.1 / 10.2 / 10.3 / 10.6 / 10.15 / 10C.5 — SourceService
// PURPOSE:
// - create a single entry point for sources layer
// - keep fetch logic OUT of chat handler
// - keep current CoinGecko simple price cache-first path
// - add minimal historical-data skeleton path for CoinGecko market_chart
//
// IMPORTANT:
// - this file must remain fail-open
// - current chat runtime must not break if source fails
// - explicit source result still has priority
// - auto runtime fetch is still limited to CoinGecko simple price only
// - market_chart is wired only by explicit sourceKey for now
// - cache is on-demand TTL only (no cron)
// ============================================================================

import { resolveSourceRuntime } from "./sourceRuntime.js";
import { fetchCoinGeckoSimplePrice } from "./fetchCoingeckoSimplePrice.js";
import { fetchCoinGeckoMarketChart } from "./fetchCoingeckoMarketChart.js";
import {
  buildSourceCacheKey,
  getSourceCacheEntry,
  upsertSourceCacheEntry,
} from "../db/sourceCacheRepo.js";
import { envIntRange } from "../core/config.js";

export const SOURCE_SERVICE_VERSION = "10C.5-market-chart-skeleton-v1";

const COINGECKO_SIMPLE_PRICE_CACHE_TTL_SEC = envIntRange(
  "COINGECKO_SIMPLE_PRICE_CACHE_TTL_SEC",
  20,
  { min: 5, max: 3600 }
);

export const SOURCE_SERVICE_DECISIONS = Object.freeze({
  SKIP: "skip",
  NOOP: "noop",
  READY_FOR_FETCH: "ready_for_fetch",
  FETCHED: "fetched",
  CACHE_HIT: "cache_hit",
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

function normalizeCoinId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeVsCurrency(value) {
  const vs = String(value || "").trim().toLowerCase();
  return vs || "usd";
}

function normalizeDays(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "7";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "7";
}

function normalizeInterval(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return "";
  if (raw === "daily") return "daily";
  if (raw === "hourly") return "hourly";

  return "";
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
      enabled: true,
      description: "CoinGecko simple price fetcher",
    },
    {
      key: "coingecko_market_chart",
      type: "json_api",
      enabled: true,
      description: "CoinGecko historical market_chart fetcher",
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
// CoinGecko helpers
// ============================================================================

function detectCoinGeckoIdsFromText(text = "") {
  const t = normalizeText(text).toLowerCase();
  if (!t) return [];

  const found = [];

  const rules = [
    { id: "bitcoin", signals: ["bitcoin", "btc", "биткоин", "біткоїн"] },
    { id: "ethereum", signals: ["ethereum", "eth", "эфир", "ефир", "ефір"] },
    { id: "binancecoin", signals: ["binance", "bnb"] },
    { id: "solana", signals: ["solana", "sol"] },
    { id: "ripple", signals: ["ripple", "xrp"] },
    { id: "toncoin", signals: ["toncoin", "ton"] },
    { id: "avalanche-2", signals: ["avalanche", "avax"] },
    { id: "aptos", signals: ["aptos", "apt"] },
    { id: "hedera-hashgraph", signals: ["hedera", "hbar"] },
    { id: "ondo-finance", signals: ["ondo"] },
    { id: "sei-network", signals: ["sei"] },
    { id: "sui", signals: ["sui"] },
    { id: "tether", signals: ["tether", "usdt"] },
  ];

  for (const rule of rules) {
    if (rule.signals.some((signal) => t.includes(signal))) {
      found.push(rule.id);
    }
  }

  return [...new Set(found)];
}

function detectVsCurrenciesFromText(text = "") {
  const t = normalizeText(text).toLowerCase();
  if (!t) return ["usd"];

  const found = [];
  if (t.includes("usd") || t.includes("доллар") || t.includes("долар") || t.includes("usdt")) {
    found.push("usd");
  }
  if (t.includes("eur") || t.includes("euro") || t.includes("евро") || t.includes("євро")) {
    found.push("eur");
  }
  if (t.includes("uah") || t.includes("грн") || t.includes("hryvnia")) {
    found.push("uah");
  }

  return found.length ? [...new Set(found)] : ["usd"];
}

function shouldAutoUseCoinGecko(plan, input = {}) {
  const explicitSourceKey = normalizeSourceKey(input?.sourceKey || "");
  const text = normalizeText(input?.text || "");

  if (explicitSourceKey === "coingecko_simple_price") return true;
  if (plan.runtime?.needsSource !== true) return false;
  if (!text) return false;

  const ids = detectCoinGeckoIdsFromText(text);
  return ids.length > 0;
}

function buildCoinGeckoFetchInput(input = {}) {
  const text = normalizeText(input?.text || "");
  const explicitIds = Array.isArray(input?.coinIds)
    ? input.coinIds.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : [];

  const ids = explicitIds.length ? explicitIds : detectCoinGeckoIdsFromText(text);
  const vsCurrencies = Array.isArray(input?.vsCurrencies)
    ? input.vsCurrencies.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
    : detectVsCurrenciesFromText(text);

  return {
    ids,
    vsCurrencies,
  };
}

function buildCoinGeckoMarketChartFetchInput(input = {}) {
  return {
    coinId: normalizeCoinId(input?.coinId),
    vsCurrency: normalizeVsCurrency(input?.vsCurrency),
    days: normalizeDays(input?.days),
    interval: normalizeInterval(input?.interval),
  };
}

function buildCachedSourceResult(entry = null) {
  const payload = entry?.payload || null;

  return {
    ok: Boolean(payload?.ok),
    sourceKey: payload?.sourceKey || "coingecko_simple_price",
    content: typeof payload?.content === "string" ? payload.content : "",
    fetchedAt: payload?.fetchedAt || entry?.fetchedAt || null,
    meta: {
      ...(payload?.meta && typeof payload.meta === "object" ? payload.meta : {}),
      cache: {
        hit: true,
        stale: Boolean(entry?.stale),
        cacheKey: entry?.cacheKey || null,
        ageSec: entry?.ageSec ?? null,
        ttlSec: entry?.ttlSec ?? null,
      },
      serviceVersion: SOURCE_SERVICE_VERSION,
    },
  };
}

// ============================================================================
// STAGE 10.2 — service plan resolution
// IMPORTANT:
// - this step decides what SHOULD happen
// - real fetch decision is still isolated below
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

  if (!runtime.needsSource && !sourceKey) {
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

  if (explicitDefinition?.key === "coingecko_market_chart") {
    return {
      version: SOURCE_SERVICE_VERSION,
      decision: SOURCE_SERVICE_DECISIONS.READY_FOR_FETCH,
      runtime,
      shouldFetch: true,
      sourceDefinition: explicitDefinition,
      reason: "explicit_coingecko_market_chart_fetch_ready",
    };
  }

  const useCoinGecko =
    explicitDefinition?.key === "coingecko_simple_price" || shouldAutoUseCoinGecko({ runtime }, input);

  if (useCoinGecko) {
    return {
      version: SOURCE_SERVICE_VERSION,
      decision: SOURCE_SERVICE_DECISIONS.READY_FOR_FETCH,
      runtime,
      shouldFetch: true,
      sourceDefinition: getSourceDefinition("coingecko_simple_price"),
      reason:
        explicitDefinition?.key === "coingecko_simple_price"
          ? "explicit_coingecko_fetch_ready"
          : "autodetected_coingecko_fetch_ready",
    };
  }

  return {
    version: SOURCE_SERVICE_VERSION,
    decision: SOURCE_SERVICE_DECISIONS.NOOP,
    runtime,
    shouldFetch: false,
    sourceDefinition: explicitDefinition,
    reason: sourceKey
      ? "registered_source_key_but_fetcher_not_implemented"
      : "source_needed_but_no_matching_fetcher",
  };
}

// ============================================================================
// STAGE 10.15 — cache-first fetch path for CoinGecko simple price
// IMPORTANT:
// - cache hit returns without network fetch
// - stale/miss falls through to network fetch
// - cache write is fail-open
// ============================================================================

async function resolveCoinGeckoWithCache(input = {}, plan) {
  const fetchInput = buildCoinGeckoFetchInput(input);

  if (!fetchInput.ids.length) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: {
        ok: false,
        sourceKey: "coingecko_simple_price",
        content: "",
        fetchedAt: new Date().toISOString(),
        meta: {
          reason: "missing_ids",
          serviceVersion: SOURCE_SERVICE_VERSION,
        },
      },
      reason: "coingecko_missing_ids",
    };
  }

  const cacheKey = buildSourceCacheKey({
    sourceKey: "coingecko_simple_price",
    ids: fetchInput.ids,
    vsCurrencies: fetchInput.vsCurrencies,
  });

  try {
    const cacheRead = await getSourceCacheEntry({ cacheKey });

    if (cacheRead?.ok && cacheRead.hit === true && cacheRead.stale === false && cacheRead.entry?.payload) {
      try {
        console.info("SOURCE_CACHE_HIT", {
          sourceKey: "coingecko_simple_price",
          cacheKey,
          ageSec: cacheRead.entry.ageSec,
          ttlSec: cacheRead.entry.ttlSec,
        });
      } catch (_) {}

      const cachedResult = buildCachedSourceResult({
        ...cacheRead.entry,
        stale: false,
      });

      return {
        version: SOURCE_SERVICE_VERSION,
        ok: Boolean(cachedResult?.ok),
        usedExistingSourceResult: false,
        shouldUseSourceResult: Boolean(cachedResult?.ok),
        shouldRequireSourceResult: false,
        sourceRuntime: plan.runtime,
        sourcePlan: {
          ...plan,
          decision: SOURCE_SERVICE_DECISIONS.CACHE_HIT,
        },
        sourceResult: cachedResult,
        reason: "coingecko_cache_hit",
      };
    }

    if (cacheRead?.ok && cacheRead.hit === true && cacheRead.stale === true) {
      try {
        console.info("SOURCE_CACHE_STALE", {
          sourceKey: "coingecko_simple_price",
          cacheKey,
          ageSec: cacheRead.entry?.ageSec ?? null,
          ttlSec: cacheRead.entry?.ttlSec ?? null,
        });
      } catch (_) {}
    } else {
      try {
        console.info("SOURCE_CACHE_MISS", {
          sourceKey: "coingecko_simple_price",
          cacheKey,
        });
      } catch (_) {}
    }
  } catch (e) {
    try {
      console.error("SOURCE_CACHE_READ_FAIL_OPEN", {
        sourceKey: "coingecko_simple_price",
        cacheKey,
        message: e?.message ? String(e.message) : "unknown_error",
      });
    } catch (_) {}
  }

  try {
    const fetched = await fetchCoinGeckoSimplePrice(fetchInput);

    if (fetched?.ok) {
      try {
        await upsertSourceCacheEntry({
          sourceKey: "coingecko_simple_price",
          cacheKey,
          payload: fetched,
          ttlSec: COINGECKO_SIMPLE_PRICE_CACHE_TTL_SEC,
        });

        try {
          console.info("SOURCE_CACHE_SAVE_OK", {
            sourceKey: "coingecko_simple_price",
            cacheKey,
            ttlSec: COINGECKO_SIMPLE_PRICE_CACHE_TTL_SEC,
          });
        } catch (_) {}
      } catch (cacheWriteError) {
        try {
          console.error("SOURCE_CACHE_WRITE_FAIL_OPEN", {
            sourceKey: "coingecko_simple_price",
            cacheKey,
            message: cacheWriteError?.message ? String(cacheWriteError.message) : "unknown_error",
          });
        } catch (_) {}
      }
    }

    return {
      version: SOURCE_SERVICE_VERSION,
      ok: Boolean(fetched?.ok),
      usedExistingSourceResult: false,
      shouldUseSourceResult: Boolean(fetched?.ok),
      shouldRequireSourceResult: false,
      sourceRuntime: plan.runtime,
      sourcePlan: {
        ...plan,
        decision: SOURCE_SERVICE_DECISIONS.FETCHED,
      },
      sourceResult: fetched,
      reason: fetched?.ok ? "coingecko_fetch_ok" : "coingecko_fetch_failed",
    };
  } catch (error) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: {
        ok: false,
        sourceKey: "coingecko_simple_price",
        content: "",
        fetchedAt: new Date().toISOString(),
        meta: {
          reason: "coingecko_fetch_exception",
          message: error?.message ? String(error.message) : "unknown_error",
          serviceVersion: SOURCE_SERVICE_VERSION,
          cache: {
            hit: false,
            stale: false,
            cacheKey,
          },
        },
      },
      reason: "coingecko_fetch_exception",
    };
  }
}

// ============================================================================
// STAGE 10C.5 — explicit historical fetch path for CoinGecko market_chart
// IMPORTANT:
// - no auto text detection yet
// - no cache yet
// - no chat wiring yet
// - explicit sourceKey only
// ============================================================================

async function resolveCoinGeckoMarketChart(input = {}, plan) {
  const fetchInput = buildCoinGeckoMarketChartFetchInput(input);

  if (!fetchInput.coinId) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: {
        ok: false,
        sourceKey: "coingecko_market_chart",
        content: "",
        fetchedAt: new Date().toISOString(),
        meta: {
          reason: "missing_coin_id",
          serviceVersion: SOURCE_SERVICE_VERSION,
        },
      },
      reason: "coingecko_market_chart_missing_coin_id",
    };
  }

  try {
    const fetched = await fetchCoinGeckoMarketChart(fetchInput);

    return {
      version: SOURCE_SERVICE_VERSION,
      ok: Boolean(fetched?.ok),
      usedExistingSourceResult: false,
      shouldUseSourceResult: Boolean(fetched?.ok),
      shouldRequireSourceResult: false,
      sourceRuntime: plan.runtime,
      sourcePlan: {
        ...plan,
        decision: SOURCE_SERVICE_DECISIONS.FETCHED,
      },
      sourceResult: fetched,
      reason: fetched?.ok
        ? "coingecko_market_chart_fetch_ok"
        : "coingecko_market_chart_fetch_failed",
    };
  } catch (error) {
    return {
      version: SOURCE_SERVICE_VERSION,
      ok: false,
      usedExistingSourceResult: false,
      shouldUseSourceResult: false,
      shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
      sourceRuntime: plan.runtime,
      sourcePlan: plan,
      sourceResult: {
        ok: false,
        sourceKey: "coingecko_market_chart",
        content: "",
        fetchedAt: new Date().toISOString(),
        meta: {
          reason: "coingecko_market_chart_fetch_exception",
          message: error?.message ? String(error.message) : "unknown_error",
          serviceVersion: SOURCE_SERVICE_VERSION,
        },
      },
      reason: "coingecko_market_chart_fetch_exception",
    };
  }
}

// ============================================================================
// STAGE 10.6 / 10.15 / 10C.5 — public service entry point
// IMPORTANT:
// - explicit source result still wins
// - fetch failures must remain non-fatal
// - caller decides whether to use fetched result in prompt/runtime
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

  if (
    plan.decision === SOURCE_SERVICE_DECISIONS.READY_FOR_FETCH &&
    plan.sourceDefinition?.key === "coingecko_simple_price"
  ) {
    return await resolveCoinGeckoWithCache(input, plan);
  }

  if (
    plan.decision === SOURCE_SERVICE_DECISIONS.READY_FOR_FETCH &&
    plan.sourceDefinition?.key === "coingecko_market_chart"
  ) {
    return await resolveCoinGeckoMarketChart(input, plan);
  }

  return {
    version: SOURCE_SERVICE_VERSION,
    ok: false,
    usedExistingSourceResult: false,
    shouldUseSourceResult: false,
    shouldRequireSourceResult: Boolean(plan.runtime?.shouldRequireSourceResult),
    sourceRuntime: plan.runtime,
    sourcePlan: plan,
    sourceResult: buildNoSourceResult("unhandled_source_plan", plan.runtime),
    reason: "unhandled_source_plan",
  };
}

// ============================================================================
// debug helper
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
    coinIds: input?.coinIds || [],
    vsCurrencies: input?.vsCurrencies || [],
    coinId: input?.coinId || "",
    vsCurrency: input?.vsCurrency || "",
    days: input?.days || "",
    interval: input?.interval || "",
  });

  const fetchInput = buildCoinGeckoFetchInput(input);
  const marketChartInput = buildCoinGeckoMarketChartFetchInput(input);

  const debugCacheKey =
    plan.sourceDefinition?.key === "coingecko_simple_price"
      ? buildSourceCacheKey({
          sourceKey: "coingecko_simple_price",
          ids: fetchInput.ids,
          vsCurrencies: fetchInput.vsCurrencies,
        })
      : "n/a";

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
    `- cache_ttl_sec: ${COINGECKO_SIMPLE_PRICE_CACHE_TTL_SEC}`,
    `- cache_key: ${debugCacheKey}`,
    `- market_chart_coin_id: ${marketChartInput.coinId || "none"}`,
    `- market_chart_vs_currency: ${marketChartInput.vsCurrency || "usd"}`,
    `- market_chart_days: ${marketChartInput.days || "7"}`,
    `- market_chart_interval: ${marketChartInput.interval || "auto"}`,
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