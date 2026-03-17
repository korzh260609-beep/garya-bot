// src/sources/coingeckoIndicators.js
// ============================================================================
// STAGE 10C.6 — CoinGecko Indicators
// PURPOSE:
// - define deterministic indicator contract for historical market_chart data
// - keep indicator logic isolated from fetcher / SourceService / chat wiring
// - prepare normalized output for future TA module
//
// IMPORTANT:
// - EMA is implemented first as the smallest reversible logic step
// - RSI and MACD remain skeleton-only
// - no chat wiring
// - no SourceService integration yet
// - fail-open
// - accepts parsed market_chart series only
// ============================================================================

export const COINGECKO_INDICATORS_VERSION = "10C.6-indicators-ema-v1";

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

function roundIndicatorValue(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(8));
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

function buildEmaSeries(prices = [], period = 20) {
  const safePeriod = normalizePositiveInt(period, 20);
  const series = normalizePriceSeries(prices);

  if (series.length < safePeriod) {
    return {
      ok: false,
      reason: "not_enough_data",
      period: safePeriod,
      values: [],
      latest: null,
      signal: null,
      inputMeta: buildSeriesMeta(series),
    };
  }

  const multiplier = 2 / (safePeriod + 1);
  const out = [];

  let seedSum = 0;
  for (let i = 0; i < safePeriod; i += 1) {
    seedSum += series[i].value;
  }

  let prevEma = seedSum / safePeriod;

  out.push({
    ts: series[safePeriod - 1].ts,
    value: roundIndicatorValue(prevEma),
  });

  for (let i = safePeriod; i < series.length; i += 1) {
    const price = series[i].value;
    prevEma = (price - prevEma) * multiplier + prevEma;

    out.push({
      ts: series[i].ts,
      value: roundIndicatorValue(prevEma),
    });
  }

  const latestPoint = out[out.length - 1] || null;
  const latestPricePoint = series[series.length - 1] || null;

  let signal = null;
  if (
    latestPoint &&
    latestPricePoint &&
    typeof latestPoint.value === "number" &&
    typeof latestPricePoint.value === "number"
  ) {
    if (latestPricePoint.value > latestPoint.value) {
      signal = "price_above_ema";
    } else if (latestPricePoint.value < latestPoint.value) {
      signal = "price_below_ema";
    } else {
      signal = "price_at_ema";
    }
  }

  return {
    ok: true,
    reason: "ema_computed",
    period: safePeriod,
    values: out,
    latest: latestPoint,
    signal,
    inputMeta: buildSeriesMeta(series),
  };
}

export function computeEma(prices = [], period = 20) {
  const result = buildEmaSeries(prices, period);

  return {
    ok: result.ok,
    indicatorKey: "ema",
    period: result.period,
    reason: result.reason,
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: result.inputMeta,
    output: {
      values: result.values,
      latest: result.latest,
      signal: result.signal,
    },
  };
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

export function buildIndicatorBundle(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const emaPeriod = normalizePositiveInt(input?.emaPeriod, 20);
  const rsiPeriod = normalizePositiveInt(input?.rsiPeriod, 14);

  return {
    ok: true,
    version: COINGECKO_INDICATORS_VERSION,
    reason: "indicator_bundle_ready",
    inputMeta: buildSeriesMeta(prices),
    indicators: {
      ema20: computeEma(prices, emaPeriod),
      rsi14: computeRsiSkeleton(prices, rsiPeriod),
      macd: computeMacdSkeleton(prices),
    },
  };
}

export function buildCoingeckoIndicatorsDebugText(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const bundle = buildIndicatorBundle({
    prices,
    emaPeriod: input?.emaPeriod,
    rsiPeriod: input?.rsiPeriod,
  });

  const ema = bundle.indicators.ema20;

  const lines = [
    "COINGECKO INDICATORS:",
    `- version: ${COINGECKO_INDICATORS_VERSION}`,
    `- prices_count: ${bundle.inputMeta.count}`,
    `- first_ts: ${bundle.inputMeta.firstTs ?? "n/a"}`,
    `- last_ts: ${bundle.inputMeta.lastTs ?? "n/a"}`,
    `- ema20_status: ${ema.reason}`,
    `- ema20_latest: ${ema.output.latest?.value ?? "n/a"}`,
    `- ema20_signal: ${ema.output.signal ?? "n/a"}`,
    `- rsi14_status: ${bundle.indicators.rsi14.reason}`,
    `- macd_status: ${bundle.indicators.macd.reason}`,
  ];

  return lines.join("\n");
}

export default {
  COINGECKO_INDICATORS_VERSION,
  normalizePriceSeries,
  buildIndicatorSkeletonResult,
  computeEma,
  computeRsiSkeleton,
  computeMacdSkeleton,
  buildIndicatorBundle,
  buildCoingeckoIndicatorsDebugText,
};