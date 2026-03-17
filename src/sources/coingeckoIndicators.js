// src/sources/coingeckoIndicators.js
// ============================================================================
// STAGE 10C.6 — CoinGecko Indicators Skeleton
// PURPOSE:
// - define deterministic indicator contract for historical market_chart data
// - keep indicator logic isolated from fetcher / SourceService / chat wiring
// - prepare normalized output for future TA module
//
// IMPORTANT:
// - skeleton only
// - no chat wiring
// - no SourceService integration yet
// - no command integration yet
// - no heavy math yet
// - fail-open
// - accepts parsed market_chart series only
// ============================================================================

export const COINGECKO_INDICATORS_VERSION = "10C.6-indicators-skeleton-v1";

function normalizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const out = Math.trunc(n);
  return out > 0 ? out : fallback;
}

function normalizeSeriesPoint(point) {
  if (!point || typeof point !== "object" || Array.isArray(point)) return null;

  const ts = normalizeNumber(point.ts);
  const value = normalizeNumber(point.value);

  if (ts === null || value === null) return null;

  return { ts, value };
}

export function normalizePriceSeries(input) {
  if (!Array.isArray(input)) return [];

  const out = [];

  for (const point of input) {
    const normalized = normalizeSeriesPoint(point);
    if (!normalized) continue;
    out.push(normalized);
  }

  return out;
}

function buildSeriesMeta(series = []) {
  if (!Array.isArray(series) || series.length === 0) {
    return {
      count: 0,
      firstTs: null,
      lastTs: null,
      firstValue: null,
      lastValue: null,
    };
  }

  return {
    count: series.length,
    firstTs: series[0]?.ts ?? null,
    lastTs: series[series.length - 1]?.ts ?? null,
    firstValue: series[0]?.value ?? null,
    lastValue: series[series.length - 1]?.value ?? null,
  };
}

export function buildIndicatorSkeletonResult({
  indicatorKey,
  period = null,
  inputSeries = [],
  reason = "not_implemented",
}) {
  const series = normalizePriceSeries(inputSeries);

  return {
    ok: false,
    indicatorKey,
    period,
    reason,
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: buildSeriesMeta(series),
    output: {
      values: [],
      latest: null,
      signal: null,
    },
  };
}

export function computeEmaSkeleton(inputSeries = [], period = 20) {
  const safePeriod = normalizePositiveInt(period, 20);

  return buildIndicatorSkeletonResult({
    indicatorKey: "ema",
    period: safePeriod,
    inputSeries,
    reason: "ema_not_implemented",
  });
}

export function computeRsiSkeleton(inputSeries = [], period = 14) {
  const safePeriod = normalizePositiveInt(period, 14);

  return buildIndicatorSkeletonResult({
    indicatorKey: "rsi",
    period: safePeriod,
    inputSeries,
    reason: "rsi_not_implemented",
  });
}

export function computeMacdSkeleton(
  inputSeries = [],
  {
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
  } = {}
) {
  const safeFastPeriod = normalizePositiveInt(fastPeriod, 12);
  const safeSlowPeriod = normalizePositiveInt(slowPeriod, 26);
  const safeSignalPeriod = normalizePositiveInt(signalPeriod, 9);

  const series = normalizePriceSeries(inputSeries);

  return {
    ok: false,
    indicatorKey: "macd",
    period: null,
    reason: "macd_not_implemented",
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: buildSeriesMeta(series),
    params: {
      fastPeriod: safeFastPeriod,
      slowPeriod: safeSlowPeriod,
      signalPeriod: safeSignalPeriod,
    },
    output: {
      macdLine: [],
      signalLine: [],
      histogram: [],
      latest: null,
      signal: null,
    },
  };
}

export function buildIndicatorBundleSkeleton(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const emaPeriod = normalizePositiveInt(input?.emaPeriod, 20);
  const rsiPeriod = normalizePositiveInt(input?.rsiPeriod, 14);

  return {
    ok: true,
    version: COINGECKO_INDICATORS_VERSION,
    reason: "indicator_bundle_skeleton_ready",
    inputMeta: buildSeriesMeta(prices),
    indicators: {
      ema20: computeEmaSkeleton(prices, emaPeriod),
      rsi14: computeRsiSkeleton(prices, rsiPeriod),
      macd: computeMacdSkeleton(prices),
    },
  };
}

export function buildCoingeckoIndicatorsDebugText(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const bundle = buildIndicatorBundleSkeleton({
    prices,
    emaPeriod: input?.emaPeriod,
    rsiPeriod: input?.rsiPeriod,
  });

  const lines = [
    "COINGECKO INDICATORS:",
    `- version: ${COINGECKO_INDICATORS_VERSION}`,
    `- prices_count: ${bundle.inputMeta.count}`,
    `- first_ts: ${bundle.inputMeta.firstTs ?? "n/a"}`,
    `- last_ts: ${bundle.inputMeta.lastTs ?? "n/a"}`,
    `- ema20_status: ${bundle.indicators.ema20.reason}`,
    `- rsi14_status: ${bundle.indicators.rsi14.reason}`,
    `- macd_status: ${bundle.indicators.macd.reason}`,
  ];

  return lines.join("\n");
}

export default {
  COINGECKO_INDICATORS_VERSION,
  normalizePriceSeries,
  buildIndicatorSkeletonResult,
  computeEmaSkeleton,
  computeRsiSkeleton,
  computeMacdSkeleton,
  buildIndicatorBundleSkeleton,
  buildCoingeckoIndicatorsDebugText,
};