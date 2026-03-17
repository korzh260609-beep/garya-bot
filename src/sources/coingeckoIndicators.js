// src/sources/coingeckoIndicators.js
// ============================================================================
// STAGE 10C.6 — CoinGecko Indicators
// PURPOSE:
// - define deterministic indicator contract for historical market_chart data
// - keep indicator logic isolated from fetcher / SourceService / chat wiring
// - prepare normalized output for future TA module
//
// IMPORTANT:
// - EMA logic is implemented
// - EMA20 / EMA50 cross signal is implemented
// - RSI(14) is implemented
// - MACD is now added as the next reversible step
// - no chat wiring
// - no SourceService integration yet
// - fail-open
// - accepts parsed market_chart series only
// ============================================================================

export const COINGECKO_INDICATORS_VERSION = "10C.6-indicators-macd-v1";

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

function buildAlignedSeriesMap(values = []) {
  const map = new Map();

  if (!Array.isArray(values)) return map;

  for (const point of values) {
    if (!point || typeof point !== "object") continue;
    if (typeof point.ts !== "number" || !Number.isFinite(point.ts)) continue;
    if (typeof point.value !== "number" || !Number.isFinite(point.value))
      continue;
    map.set(point.ts, point.value);
  }

  return map;
}

export function computeEmaCross(prices = [], fastPeriod = 20, slowPeriod = 50) {
  const safeFastPeriod = normalizePositiveInt(fastPeriod, 20);
  const safeSlowPeriod = normalizePositiveInt(slowPeriod, 50);
  const series = normalizePriceSeries(prices);

  const fast = computeEma(series, safeFastPeriod);
  const slow = computeEma(series, safeSlowPeriod);

  if (!fast.ok || !slow.ok) {
    return {
      ok: false,
      indicatorKey: "ema_cross",
      reason: "ema_cross_inputs_not_ready",
      version: COINGECKO_INDICATORS_VERSION,
      inputMeta: buildSeriesMeta(series),
      params: {
        fastPeriod: safeFastPeriod,
        slowPeriod: safeSlowPeriod,
      },
      output: {
        values: [],
        latest: null,
        signal: null,
      },
    };
  }

  const fastMap = buildAlignedSeriesMap(fast.output.values);
  const slowMap = buildAlignedSeriesMap(slow.output.values);

  const aligned = [];

  for (const [ts, fastValue] of fastMap.entries()) {
    const slowValue = slowMap.get(ts);
    if (typeof slowValue !== "number") continue;

    aligned.push({
      ts,
      fastValue: roundIndicatorValue(fastValue),
      slowValue: roundIndicatorValue(slowValue),
      spread: roundIndicatorValue(fastValue - slowValue),
    });
  }

  aligned.sort((a, b) => a.ts - b.ts);

  const latest = aligned[aligned.length - 1] || null;
  const prev = aligned.length >= 2 ? aligned[aligned.length - 2] : null;

  let signal = null;

  if (latest) {
    if (prev) {
      if (prev.spread <= 0 && latest.spread > 0) {
        signal = "bullish_cross";
      } else if (prev.spread >= 0 && latest.spread < 0) {
        signal = "bearish_cross";
      } else if (latest.spread > 0) {
        signal = "fast_above_slow";
      } else if (latest.spread < 0) {
        signal = "fast_below_slow";
      } else {
        signal = "fast_equals_slow";
      }
    } else {
      if (latest.spread > 0) {
        signal = "fast_above_slow";
      } else if (latest.spread < 0) {
        signal = "fast_below_slow";
      } else {
        signal = "fast_equals_slow";
      }
    }
  }

  return {
    ok: true,
    indicatorKey: "ema_cross",
    reason: "ema_cross_computed",
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: buildSeriesMeta(series),
    params: {
      fastPeriod: safeFastPeriod,
      slowPeriod: safeSlowPeriod,
    },
    output: {
      values: aligned,
      latest,
      signal,
    },
  };
}

export function computeRsi(prices = [], period = 14) {
  const safePeriod = normalizePositiveInt(period, 14);
  const series = normalizePriceSeries(prices);

  if (series.length <= safePeriod) {
    return {
      ok: false,
      indicatorKey: "rsi",
      period: safePeriod,
      reason: "not_enough_data",
      version: COINGECKO_INDICATORS_VERSION,
      inputMeta: buildSeriesMeta(series),
      output: {
        values: [],
        latest: null,
        signal: null,
      },
    };
  }

  let gainSum = 0;
  let lossSum = 0;

  for (let i = 1; i <= safePeriod; i += 1) {
    const change = series[i].value - series[i - 1].value;
    if (change > 0) {
      gainSum += change;
    } else if (change < 0) {
      lossSum += Math.abs(change);
    }
  }

  let avgGain = gainSum / safePeriod;
  let avgLoss = lossSum / safePeriod;

  const values = [];

  const firstRs =
    avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
  const firstRsi =
    avgLoss === 0 ? 100 : roundIndicatorValue(100 - 100 / (1 + firstRs));

  values.push({
    ts: series[safePeriod].ts,
    value: firstRsi,
  });

  for (let i = safePeriod + 1; i < series.length; i += 1) {
    const change = series[i].value - series[i - 1].value;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (safePeriod - 1) + gain) / safePeriod;
    avgLoss = (avgLoss * (safePeriod - 1) + loss) / safePeriod;

    const rs = avgLoss === 0 ? Number.POSITIVE_INFINITY : avgGain / avgLoss;
    const rsi =
      avgLoss === 0 ? 100 : roundIndicatorValue(100 - 100 / (1 + rs));

    values.push({
      ts: series[i].ts,
      value: rsi,
    });
  }

  const latest = values[values.length - 1] || null;

  let signal = null;
  if (latest && typeof latest.value === "number") {
    if (latest.value >= 70) {
      signal = "overbought";
    } else if (latest.value <= 30) {
      signal = "oversold";
    } else if (latest.value > 50) {
      signal = "bullish_zone";
    } else if (latest.value < 50) {
      signal = "bearish_zone";
    } else {
      signal = "neutral_50";
    }
  }

  return {
    ok: true,
    indicatorKey: "rsi",
    period: safePeriod,
    reason: "rsi_computed",
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: buildSeriesMeta(series),
    output: {
      values,
      latest,
      signal,
    },
  };
}

function buildSeriesFromPoints(points = [], valueKey = "value") {
  const out = [];

  if (!Array.isArray(points)) return out;

  for (const point of points) {
    if (!point || typeof point !== "object") continue;
    if (typeof point.ts !== "number" || !Number.isFinite(point.ts)) continue;

    const value = point[valueKey];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;

    out.push({
      ts: point.ts,
      value,
    });
  }

  return out;
}

export function computeMacd(
  prices = [],
  {
    fastPeriod = 12,
    slowPeriod = 26,
    signalPeriod = 9,
  } = {}
) {
  const safeFastPeriod = normalizePositiveInt(fastPeriod, 12);
  const safeSlowPeriod = normalizePositiveInt(slowPeriod, 26);
  const safeSignalPeriod = normalizePositiveInt(signalPeriod, 9);
  const series = normalizePriceSeries(prices);

  const fast = computeEma(series, safeFastPeriod);
  const slow = computeEma(series, safeSlowPeriod);

  if (!fast.ok || !slow.ok) {
    return {
      ok: false,
      indicatorKey: "macd",
      period: null,
      reason: "macd_inputs_not_ready",
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

  const fastMap = buildAlignedSeriesMap(fast.output.values);
  const slowMap = buildAlignedSeriesMap(slow.output.values);

  const macdLine = [];

  for (const [ts, fastValue] of fastMap.entries()) {
    const slowValue = slowMap.get(ts);
    if (typeof slowValue !== "number") continue;

    macdLine.push({
      ts,
      value: roundIndicatorValue(fastValue - slowValue),
    });
  }

  macdLine.sort((a, b) => a.ts - b.ts);

  const signalInput = buildSeriesFromPoints(macdLine);
  const signalEma = computeEma(signalInput, safeSignalPeriod);

  if (!signalEma.ok) {
    return {
      ok: false,
      indicatorKey: "macd",
      period: null,
      reason: "macd_signal_not_ready",
      version: COINGECKO_INDICATORS_VERSION,
      inputMeta: buildSeriesMeta(series),
      params: {
        fastPeriod: safeFastPeriod,
        slowPeriod: safeSlowPeriod,
        signalPeriod: safeSignalPeriod,
      },
      output: {
        macdLine,
        signalLine: [],
        histogram: [],
        latest: null,
        signal: null,
      },
    };
  }

  const signalLine = signalEma.output.values.map((point) => ({
    ts: point.ts,
    value: roundIndicatorValue(point.value),
  }));

  const signalMap = buildAlignedSeriesMap(signalLine);
  const histogram = [];

  for (const point of macdLine) {
    const signalValue = signalMap.get(point.ts);
    if (typeof signalValue !== "number") continue;

    histogram.push({
      ts: point.ts,
      value: roundIndicatorValue(point.value - signalValue),
    });
  }

  const histogramMap = buildAlignedSeriesMap(histogram);
  const aligned = [];

  for (const point of macdLine) {
    const signalValue = signalMap.get(point.ts);
    const histogramValue = histogramMap.get(point.ts);

    if (
      typeof signalValue !== "number" ||
      typeof histogramValue !== "number"
    ) {
      continue;
    }

    aligned.push({
      ts: point.ts,
      macd: roundIndicatorValue(point.value),
      signal: roundIndicatorValue(signalValue),
      histogram: roundIndicatorValue(histogramValue),
    });
  }

  aligned.sort((a, b) => a.ts - b.ts);

  const latest = aligned[aligned.length - 1] || null;
  const prev = aligned.length >= 2 ? aligned[aligned.length - 2] : null;

  let signal = null;

  if (latest) {
    if (prev) {
      const prevSpread = prev.macd - prev.signal;
      const latestSpread = latest.macd - latest.signal;

      if (prevSpread <= 0 && latestSpread > 0) {
        signal = "bullish_cross";
      } else if (prevSpread >= 0 && latestSpread < 0) {
        signal = "bearish_cross";
      } else if (latest.histogram > 0) {
        signal = "bullish_momentum";
      } else if (latest.histogram < 0) {
        signal = "bearish_momentum";
      } else {
        signal = "neutral_momentum";
      }
    } else if (latest.histogram > 0) {
      signal = "bullish_momentum";
    } else if (latest.histogram < 0) {
      signal = "bearish_momentum";
    } else {
      signal = "neutral_momentum";
    }
  }

  return {
    ok: true,
    indicatorKey: "macd",
    period: null,
    reason: "macd_computed",
    version: COINGECKO_INDICATORS_VERSION,
    inputMeta: buildSeriesMeta(series),
    params: {
      fastPeriod: safeFastPeriod,
      slowPeriod: safeSlowPeriod,
      signalPeriod: safeSignalPeriod,
    },
    output: {
      macdLine,
      signalLine,
      histogram,
      latest,
      signal,
    },
  };
}

export function buildIndicatorBundle(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const emaPeriod = normalizePositiveInt(input?.emaPeriod, 20);
  const rsiPeriod = normalizePositiveInt(input?.rsiPeriod, 14);
  const emaSlowPeriod = normalizePositiveInt(input?.emaSlowPeriod, 50);

  return {
    ok: true,
    version: COINGECKO_INDICATORS_VERSION,
    reason: "indicator_bundle_ready",
    inputMeta: buildSeriesMeta(prices),
    indicators: {
      ema20: computeEma(prices, emaPeriod),
      ema50: computeEma(prices, emaSlowPeriod),
      emaCross: computeEmaCross(prices, emaPeriod, emaSlowPeriod),
      rsi14: computeRsi(prices, rsiPeriod),
      macd: computeMacd(prices),
    },
  };
}

export function buildCoingeckoIndicatorsDebugText(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const bundle = buildIndicatorBundle({
    prices,
    emaPeriod: input?.emaPeriod,
    emaSlowPeriod: input?.emaSlowPeriod,
    rsiPeriod: input?.rsiPeriod,
  });

  const ema20 = bundle.indicators.ema20;
  const ema50 = bundle.indicators.ema50;
  const emaCross = bundle.indicators.emaCross;
  const rsi14 = bundle.indicators.rsi14;
  const macd = bundle.indicators.macd;

  const lines = [
    "COINGECKO INDICATORS:",
    `- version: ${COINGECKO_INDICATORS_VERSION}`,
    `- prices_count: ${bundle.inputMeta.count}`,
    `- first_ts: ${bundle.inputMeta.firstTs ?? "n/a"}`,
    `- last_ts: ${bundle.inputMeta.lastTs ?? "n/a"}`,
    `- ema20_status: ${ema20.reason}`,
    `- ema20_latest: ${ema20.output.latest?.value ?? "n/a"}`,
    `- ema20_signal: ${ema20.output.signal ?? "n/a"}`,
    `- ema50_status: ${ema50.reason}`,
    `- ema50_latest: ${ema50.output.latest?.value ?? "n/a"}`,
    `- ema50_signal: ${ema50.output.signal ?? "n/a"}`,
    `- ema_cross_status: ${emaCross.reason}`,
    `- ema_cross_latest_spread: ${emaCross.output.latest?.spread ?? "n/a"}`,
    `- ema_cross_signal: ${emaCross.output.signal ?? "n/a"}`,
    `- rsi14_status: ${rsi14.reason}`,
    `- rsi14_latest: ${rsi14.output.latest?.value ?? "n/a"}`,
    `- rsi14_signal: ${rsi14.output.signal ?? "n/a"}`,
    `- macd_status: ${macd.reason}`,
    `- macd_latest_macd: ${macd.output.latest?.macd ?? "n/a"}`,
    `- macd_latest_signal: ${macd.output.latest?.signal ?? "n/a"}`,
    `- macd_latest_histogram: ${macd.output.latest?.histogram ?? "n/a"}`,
    `- macd_signal: ${macd.output.signal ?? "n/a"}`,
  ];

  return lines.join("\n");
}

export default {
  COINGECKO_INDICATORS_VERSION,
  normalizePriceSeries,
  buildIndicatorSkeletonResult,
  computeEma,
  computeEmaCross,
  computeRsi,
  computeMacd,
  buildIndicatorBundle,
  buildCoingeckoIndicatorsDebugText,
};