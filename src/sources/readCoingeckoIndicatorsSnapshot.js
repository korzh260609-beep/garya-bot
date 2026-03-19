// src/sources/readCoingeckoIndicatorsSnapshot.js
// ============================================================================
// STAGE 10C.34
// DIRECT INTERNAL TA SNAPSHOT SOURCE — COINGECKO INDICATORS
//
// PURPOSE:
// - read CoinGecko market_chart directly through internal fetcher
// - build indicator bundle directly without debug HTTP route dependency
// - return SG-friendly normalized snapshot for future TA module steps
// - keep this layer source-only and deterministic
//
// IMPORTANT:
// - no chat wiring
// - no SourceService changes
// - no debug route dependency
// - no TP/SL
// - no execution logic
// - fail-open
// ============================================================================

import { fetchCoinGeckoMarketChart } from "./fetchCoingeckoMarketChart.js";
import { buildIndicatorBundle } from "./coingeckoIndicators.js";

export const COINGECKO_INDICATORS_SNAPSHOT_VERSION =
  "10C.34-direct-snapshot-v1";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;

  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeCoinId(value) {
  return normalizeString(value).toLowerCase() || "bitcoin";
}

function normalizeVsCurrency(value) {
  return normalizeString(value).toLowerCase() || "usd";
}

function normalizeDays(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "30";
  if (raw === "max") return "max";

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return String(Math.trunc(n));
  }

  return "30";
}

function normalizeInterval(value) {
  const raw = normalizeString(value).toLowerCase();

  if (!raw) return "";
  if (raw === "daily") return "daily";
  if (raw === "hourly") return "hourly";

  return "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildNotReadyResult(reason, extra = {}) {
  return {
    ok: false,
    sourceKey: "coingecko_indicators_snapshot",
    snapshotVersion: COINGECKO_INDICATORS_SNAPSHOT_VERSION,
    reason,
    fetchedAt: new Date().toISOString(),
    request: {
      coinId: extra.coinId || null,
      vsCurrency: extra.vsCurrency || null,
      days: extra.days || null,
      interval: extra.interval || null,
      emaPeriod: extra.emaPeriod || null,
      emaSlowPeriod: extra.emaSlowPeriod || null,
      rsiPeriod: extra.rsiPeriod || null,
      timeoutMs: extra.timeoutMs || null,
      maxAttempts: extra.maxAttempts || null,
      retryDelayMs: extra.retryDelayMs || null,
    },
    fetchMeta: {
      marketChartOk: extra.marketChartOk === true,
      marketChartReason: extra.marketChartReason || null,
      marketChartStatus: extra.marketChartStatus ?? null,
      pricesCount: extra.pricesCount ?? null,
      url: extra.url || null,
      durationMs: extra.durationMs ?? null,
      intervalUsed: extra.intervalUsed || null,
      fallbackUsed: extra.fallbackUsed === true,
      attempts: Array.isArray(extra.attempts) ? extra.attempts : [],
      rawPreview: extra.rawPreview || null,
    },
    snapshot: {
      signal: null,
      confidence: null,
      triggerStatus: null,
      readinessScore: null,
      readinessLabel: null,
      bias: null,
      hint: null,
      context: null,
      setup: null,
      priority: null,
      attentionLevel: null,
      shouldWaitForConfirmation: null,
      explanationShort: null,
      branchReason: null,
      note: null,
      summaryLine: null,
      basedOn: {
        marketBias: null,
        momentumBias: null,
        trendStrength: null,
        signalSummary: null,
      },
    },
    sgView: {
      branch: null,
      status: "not_ready",
      readiness: null,
      shortText: null,
      note: null,
    },
    meta: extra.meta || {},
  };
}

function buildReadyResult({
  input,
  marketChartResult,
  bundle,
}) {
  const summary = isPlainObject(bundle?.summary) ? bundle.summary : {};
  const signalSummary = isPlainObject(summary?.signalSummary)
    ? summary.signalSummary
    : {};
  const entryHints = isPlainObject(bundle?.entryHints) ? bundle.entryHints : {};
  const basedOn = isPlainObject(entryHints?.basedOn) ? entryHints.basedOn : {};
  const parsedMeta = marketChartResult?.meta?.parsed?.meta || {};

  const signal = normalizeString(signalSummary?.signal) || null;
  const confidence = normalizeString(entryHints?.confidence) || null;
  const triggerStatus = normalizeString(entryHints?.triggerStatus) || null;
  const readinessLabel = normalizeString(entryHints?.readinessLabel) || null;
  const bias = normalizeString(entryHints?.bias) || null;
  const hint = normalizeString(entryHints?.hint) || null;
  const context = normalizeString(entryHints?.context) || null;
  const setup = normalizeString(entryHints?.setup) || null;
  const priority = normalizeString(entryHints?.priority) || null;
  const attentionLevel = normalizeString(entryHints?.attentionLevel) || null;
  const explanationShort = normalizeString(entryHints?.explanationShort) || null;
  const branchReason = normalizeString(entryHints?.branchReason) || null;
  const note = normalizeString(entryHints?.note) || null;
  const summaryLine = normalizeString(entryHints?.summaryLine) || null;

  return {
    ok: true,
    sourceKey: "coingecko_indicators_snapshot",
    snapshotVersion: COINGECKO_INDICATORS_SNAPSHOT_VERSION,
    reason: "coingecko_indicators_snapshot_ready",
    fetchedAt: new Date().toISOString(),
    request: {
      coinId: input.coinId,
      vsCurrency: input.vsCurrency,
      days: input.days,
      interval: input.interval || null,
      emaPeriod: input.emaPeriod,
      emaSlowPeriod: input.emaSlowPeriod,
      rsiPeriod: input.rsiPeriod,
      timeoutMs: input.timeoutMs,
      maxAttempts: input.maxAttempts,
      retryDelayMs: input.retryDelayMs,
    },
    fetchMeta: {
      marketChartOk: marketChartResult?.ok === true,
      marketChartReason: marketChartResult?.meta?.reason || null,
      marketChartStatus: marketChartResult?.meta?.status ?? null,
      pricesCount: parsedMeta?.prices?.count ?? null,
      url: marketChartResult?.meta?.url || null,
      durationMs: marketChartResult?.meta?.durationMs ?? null,
      intervalUsed: marketChartResult?.meta?.interval || null,
      fallbackUsed: marketChartResult?.meta?.fallbackUsed === true,
      attempts: Array.isArray(marketChartResult?.meta?.attempts)
        ? marketChartResult.meta.attempts
        : [],
      rawPreview: marketChartResult?.meta?.rawPreview || null,
    },
    bundleMeta: {
      bundleOk: bundle?.ok === true,
      bundleReason: bundle?.reason || null,
      indicatorsReady: bundle?.indicatorsReady === true,
      indicatorVersion: bundle?.version || null,
      inputMeta: bundle?.inputMeta || null,
      summaryOk: summary?.ok === true,
      summaryReason: summary?.reason || null,
      signalSummaryOk: signalSummary?.ok === true,
      signalSummaryReason: signalSummary?.reason || null,
      entryHintsOk: entryHints?.ok === true,
      entryHintsReason: entryHints?.reason || null,
    },
    snapshot: {
      signal,
      confidence,
      triggerStatus,
      readinessScore:
        typeof entryHints?.readinessScore === "number"
          ? entryHints.readinessScore
          : null,
      readinessLabel,
      bias,
      hint,
      context,
      setup,
      priority,
      attentionLevel,
      shouldWaitForConfirmation:
        typeof entryHints?.shouldWaitForConfirmation === "boolean"
          ? entryHints.shouldWaitForConfirmation
          : null,
      explanationShort,
      branchReason,
      note,
      summaryLine,
      basedOn: {
        marketBias: normalizeString(basedOn?.marketBias) || null,
        momentumBias: normalizeString(basedOn?.momentumBias) || null,
        trendStrength: normalizeString(basedOn?.trendStrength) || null,
        signalSummary: normalizeString(basedOn?.signalSummary) || null,
      },
    },
    sgView: {
      branch: signal,
      status: triggerStatus || "unknown",
      readiness: readinessLabel,
      shortText: explanationShort,
      note,
    },
    raw: {
      marketChartContent: normalizeString(marketChartResult?.content) || null,
      pricesMeta: parsedMeta?.prices || null,
      marketCapsMeta: parsedMeta?.marketCaps || null,
      totalVolumesMeta: parsedMeta?.totalVolumes || null,
    },
    debug: {
      summary,
      entryHints,
    },
  };
}

export async function readCoingeckoIndicatorsSnapshot(input = {}) {
  const normalizedInput = {
    coinId: normalizeCoinId(input?.coinId),
    vsCurrency: normalizeVsCurrency(input?.vsCurrency),
    days: normalizeDays(input?.days),
    interval: normalizeInterval(input?.interval),
    emaPeriod: normalizePositiveInt(input?.emaPeriod, 20),
    emaSlowPeriod: normalizePositiveInt(input?.emaSlowPeriod, 50),
    rsiPeriod: normalizePositiveInt(input?.rsiPeriod, 14),
    timeoutMs: normalizePositiveInt(input?.timeoutMs, 8000),
    maxAttempts: normalizePositiveInt(input?.maxAttempts, 2),
    retryDelayMs: normalizePositiveInt(input?.retryDelayMs, 700),
  };

  const marketChartResult = await fetchCoinGeckoMarketChart({
    coinId: normalizedInput.coinId,
    vsCurrency: normalizedInput.vsCurrency,
    days: normalizedInput.days,
    interval: normalizedInput.interval,
    timeoutMs: normalizedInput.timeoutMs,
    maxAttempts: normalizedInput.maxAttempts,
    retryDelayMs: normalizedInput.retryDelayMs,
  });

  if (!marketChartResult?.ok) {
    return buildNotReadyResult("market_chart_not_ready", {
      ...normalizedInput,
      marketChartOk: false,
      marketChartReason: marketChartResult?.meta?.reason || null,
      marketChartStatus: marketChartResult?.meta?.status ?? null,
      pricesCount: marketChartResult?.meta?.parsed?.meta?.prices?.count ?? 0,
      url: marketChartResult?.meta?.url || null,
      durationMs: marketChartResult?.meta?.durationMs ?? null,
      intervalUsed: marketChartResult?.meta?.interval || null,
      fallbackUsed: marketChartResult?.meta?.fallbackUsed === true,
      attempts: Array.isArray(marketChartResult?.meta?.attempts)
        ? marketChartResult.meta.attempts
        : [],
      rawPreview: marketChartResult?.meta?.rawPreview || null,
      meta: {
        fetchVersion: marketChartResult?.meta?.version || null,
        fetchReason: marketChartResult?.meta?.reason || null,
      },
    });
  }

  const prices = marketChartResult?.meta?.parsed?.prices;

  if (!Array.isArray(prices) || prices.length === 0) {
    return buildNotReadyResult("market_chart_prices_empty", {
      ...normalizedInput,
      marketChartOk: true,
      marketChartReason: marketChartResult?.meta?.reason || null,
      marketChartStatus: marketChartResult?.meta?.status ?? null,
      pricesCount: 0,
      url: marketChartResult?.meta?.url || null,
      durationMs: marketChartResult?.meta?.durationMs ?? null,
      intervalUsed: marketChartResult?.meta?.interval || null,
      fallbackUsed: marketChartResult?.meta?.fallbackUsed === true,
      attempts: Array.isArray(marketChartResult?.meta?.attempts)
        ? marketChartResult.meta.attempts
        : [],
      rawPreview: marketChartResult?.meta?.rawPreview || null,
      meta: {
        fetchVersion: marketChartResult?.meta?.version || null,
        fetchReason: marketChartResult?.meta?.reason || null,
      },
    });
  }

  const bundle = buildIndicatorBundle({
    prices,
    emaPeriod: normalizedInput.emaPeriod,
    emaSlowPeriod: normalizedInput.emaSlowPeriod,
    rsiPeriod: normalizedInput.rsiPeriod,
  });

  if (!bundle?.ok) {
    return buildNotReadyResult("indicator_bundle_not_ready", {
      ...normalizedInput,
      marketChartOk: true,
      marketChartReason: marketChartResult?.meta?.reason || null,
      marketChartStatus: marketChartResult?.meta?.status ?? null,
      pricesCount: prices.length,
      url: marketChartResult?.meta?.url || null,
      durationMs: marketChartResult?.meta?.durationMs ?? null,
      intervalUsed: marketChartResult?.meta?.interval || null,
      fallbackUsed: marketChartResult?.meta?.fallbackUsed === true,
      attempts: Array.isArray(marketChartResult?.meta?.attempts)
        ? marketChartResult.meta.attempts
        : [],
      rawPreview: marketChartResult?.meta?.rawPreview || null,
      meta: {
        fetchVersion: marketChartResult?.meta?.version || null,
        fetchReason: marketChartResult?.meta?.reason || null,
        bundleVersion: bundle?.version || null,
        bundleReason: bundle?.reason || null,
        indicatorsReady: bundle?.indicatorsReady === true,
        summaryOk: bundle?.summary?.ok === true,
        summaryReason: bundle?.summary?.reason || null,
        entryHintsOk: bundle?.entryHints?.ok === true,
        entryHintsReason: bundle?.entryHints?.reason || null,
      },
    });
  }

  return buildReadyResult({
    input: normalizedInput,
    marketChartResult,
    bundle,
  });
}

export default {
  readCoingeckoIndicatorsSnapshot,
};