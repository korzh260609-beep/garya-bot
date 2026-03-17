// src/sources/coingeckoIndicators.js
// ============================================================================
// STAGE 10C.7 → next additive step
// PURPOSE:
// - define deterministic indicator contract for historical market_chart data
// - keep indicator logic isolated from fetcher / SourceService / chat wiring
// - prepare normalized output for future TA module
//
// IMPORTANT:
// - existing indicator logic is preserved
// - existing summary fields are preserved
// - readiness logic fixed:
//   - summary.ok is honest
//   - bundle.ok is honest
// - indicatorsReady added
// - sorting added in normalizePriceSeries()
// - dedup by ts added in normalizePriceSeries()
// - signal_summary logic improved for conflicting trend/momentum states
// - no chat wiring
// - no SourceService integration yet
// - fail-open
// - accepts parsed market_chart series only
// ============================================================================

export const COINGECKO_INDICATORS_VERSION =
  "10C.11-indicators-summary-quality-v1";

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

  out.sort((a, b) => a.ts - b.ts);

  if (out.length <= 1) {
    return out;
  }

  const deduped = [];

  for (const point of out) {
    const last = deduped[deduped.length - 1];

    if (last && last.ts === point.ts) {
      deduped[deduped.length - 1] = point;
      continue;
    }

    deduped.push(point);
  }

  return deduped;
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

function buildMarketBias(indicators = {}) {
  const ema20 = indicators?.ema20;
  const ema50 = indicators?.ema50;
  const emaCross = indicators?.emaCross;

  const result = {
    ok: false,
    reason: "market_bias_inputs_not_ready",
    signal: null,
  };

  if (!ema20?.ok || !ema50?.ok || !emaCross?.ok) {
    return result;
  }

  const ema20Signal = ema20.output?.signal || null;
  const ema50Signal = ema50.output?.signal || null;
  const emaCrossSignal = emaCross.output?.signal || null;

  let signal = "neutral";

  if (
    emaCrossSignal === "bullish_cross" ||
    (emaCrossSignal === "fast_above_slow" &&
      ema20Signal === "price_above_ema" &&
      ema50Signal === "price_above_ema")
  ) {
    signal = "bullish";
  } else if (
    emaCrossSignal === "bearish_cross" ||
    (emaCrossSignal === "fast_below_slow" &&
      ema20Signal === "price_below_ema" &&
      ema50Signal === "price_below_ema")
  ) {
    signal = "bearish";
  } else if (
    emaCrossSignal === "fast_above_slow" ||
    ema20Signal === "price_above_ema"
  ) {
    signal = "slightly_bullish";
  } else if (
    emaCrossSignal === "fast_below_slow" ||
    ema20Signal === "price_below_ema"
  ) {
    signal = "slightly_bearish";
  }

  return {
    ok: true,
    reason: "market_bias_ready",
    signal,
  };
}

function buildMomentumBias(indicators = {}) {
  const rsi14 = indicators?.rsi14;
  const macd = indicators?.macd;

  const result = {
    ok: false,
    reason: "momentum_bias_inputs_not_ready",
    signal: null,
  };

  if (!rsi14?.ok || !macd?.ok) {
    return result;
  }

  const rsiValue = rsi14.output?.latest?.value;
  const rsiSignal = rsi14.output?.signal || null;
  const macdSignal = macd.output?.signal || null;

  let signal = "neutral";

  if (
    (macdSignal === "bullish_cross" || macdSignal === "bullish_momentum") &&
    typeof rsiValue === "number" &&
    rsiValue > 55
  ) {
    signal = "bullish";
  } else if (
    (macdSignal === "bearish_cross" || macdSignal === "bearish_momentum") &&
    typeof rsiValue === "number" &&
    rsiValue < 45
  ) {
    signal = "bearish";
  } else if (
    rsiSignal === "overbought" &&
    (macdSignal === "bullish_cross" || macdSignal === "bullish_momentum")
  ) {
    signal = "bullish_overheated";
  } else if (
    rsiSignal === "oversold" &&
    (macdSignal === "bearish_cross" || macdSignal === "bearish_momentum")
  ) {
    signal = "bearish_exhausted";
  } else if (
    macdSignal === "bullish_cross" ||
    macdSignal === "bullish_momentum" ||
    rsiSignal === "bullish_zone"
  ) {
    signal = "slightly_bullish";
  } else if (
    macdSignal === "bearish_cross" ||
    macdSignal === "bearish_momentum" ||
    rsiSignal === "bearish_zone"
  ) {
    signal = "slightly_bearish";
  }

  return {
    ok: true,
    reason: "momentum_bias_ready",
    signal,
  };
}

function buildTrendStrength(indicators = {}, summary = {}) {
  const emaCrossSignal = indicators?.emaCross?.output?.signal || null;
  const macdSignal = indicators?.macd?.output?.signal || null;
  const rsiValue = indicators?.rsi14?.output?.latest?.value;
  const marketBiasSignal = summary?.marketBias?.signal || null;
  const momentumBiasSignal = summary?.momentumBias?.signal || null;

  const result = {
    ok: false,
    reason: "trend_strength_inputs_not_ready",
    score: null,
    signal: null,
  };

  if (
    !summary?.marketBias?.ok ||
    !summary?.momentumBias?.ok ||
    !indicators?.emaCross?.ok ||
    !indicators?.macd?.ok ||
    !indicators?.rsi14?.ok
  ) {
    return result;
  }

  let score = 0;

  if (marketBiasSignal === "bullish") score += 3;
  else if (marketBiasSignal === "slightly_bullish") score += 1;
  else if (marketBiasSignal === "bearish") score -= 3;
  else if (marketBiasSignal === "slightly_bearish") score -= 1;

  if (momentumBiasSignal === "bullish") score += 2;
  else if (
    momentumBiasSignal === "slightly_bullish" ||
    momentumBiasSignal === "bullish_overheated"
  ) {
    score += 1;
  } else if (momentumBiasSignal === "bearish") score -= 2;
  else if (
    momentumBiasSignal === "slightly_bearish" ||
    momentumBiasSignal === "bearish_exhausted"
  ) {
    score -= 1;
  }

  if (emaCrossSignal === "bullish_cross") score += 2;
  else if (emaCrossSignal === "fast_above_slow") score += 1;
  else if (emaCrossSignal === "bearish_cross") score -= 2;
  else if (emaCrossSignal === "fast_below_slow") score -= 1;

  if (macdSignal === "bullish_cross") score += 2;
  else if (macdSignal === "bullish_momentum") score += 1;
  else if (macdSignal === "bearish_cross") score -= 2;
  else if (macdSignal === "bearish_momentum") score -= 1;

  if (typeof rsiValue === "number") {
    if (rsiValue >= 60 && rsiValue < 70) score += 1;
    else if (rsiValue <= 40 && rsiValue > 30) score -= 1;
    else if (rsiValue >= 70) score += 0;
    else if (rsiValue <= 30) score -= 0;
  }

  let signal = "neutral";

  if (score >= 6) {
    signal = "strong_bullish";
  } else if (score >= 3) {
    signal = "bullish";
  } else if (score >= 1) {
    signal = "slightly_bullish";
  } else if (score <= -6) {
    signal = "strong_bearish";
  } else if (score <= -3) {
    signal = "bearish";
  } else if (score <= -1) {
    signal = "slightly_bearish";
  }

  return {
    ok: true,
    reason: "trend_strength_ready",
    score,
    signal,
  };
}

function buildSignalSummary(summary = {}) {
  const marketBiasSignal = summary?.marketBias?.signal || null;
  const momentumBiasSignal = summary?.momentumBias?.signal || null;
  const trendStrengthSignal = summary?.trendStrength?.signal || null;
  const trendStrengthScore = summary?.trendStrength?.score;

  const result = {
    ok: false,
    reason: "signal_summary_inputs_not_ready",
    signal: null,
    confidence: null,
  };

  if (
    !summary?.marketBias?.ok ||
    !summary?.momentumBias?.ok ||
    !summary?.trendStrength?.ok
  ) {
    return result;
  }

  let signal = "neutral";
  let confidence = "low";

  const marketBullish =
    marketBiasSignal === "bullish" || marketBiasSignal === "slightly_bullish";
  const marketBearish =
    marketBiasSignal === "bearish" || marketBiasSignal === "slightly_bearish";

  const momentumBullish =
    momentumBiasSignal === "bullish" ||
    momentumBiasSignal === "slightly_bullish" ||
    momentumBiasSignal === "bullish_overheated";

  const momentumBearish =
    momentumBiasSignal === "bearish" ||
    momentumBiasSignal === "slightly_bearish" ||
    momentumBiasSignal === "bearish_exhausted";

  if (
    trendStrengthSignal === "strong_bullish" &&
    marketBullish &&
    momentumBullish
  ) {
    signal = "buy";
    confidence = "high";
  } else if (
    trendStrengthSignal === "bullish" &&
    marketBiasSignal !== "bearish" &&
    momentumBiasSignal !== "bearish"
  ) {
    signal = "buy_watch";
    confidence = "medium";
  } else if (
    trendStrengthSignal === "strong_bearish" &&
    marketBearish &&
    momentumBearish
  ) {
    signal = "sell";
    confidence = "high";
  } else if (
    trendStrengthSignal === "bearish" &&
    marketBiasSignal !== "bullish" &&
    momentumBiasSignal !== "bullish"
  ) {
    signal = "sell_watch";
    confidence = "medium";
  } else if (
    marketBullish &&
    momentumBearish &&
    (trendStrengthSignal === "bullish" ||
      trendStrengthSignal === "slightly_bullish" ||
      trendStrengthSignal === "strong_bullish")
  ) {
    signal = "pullback_in_uptrend";
    confidence = "medium";
  } else if (
    marketBearish &&
    momentumBullish &&
    (trendStrengthSignal === "bearish" ||
      trendStrengthSignal === "slightly_bearish" ||
      trendStrengthSignal === "strong_bearish")
  ) {
    signal = "bounce_in_downtrend";
    confidence = "medium";
  } else if (
    trendStrengthSignal === "slightly_bullish" ||
    trendStrengthSignal === "slightly_bearish"
  ) {
    signal = "wait";
    confidence = "low";
  } else if (trendStrengthSignal === "neutral") {
    signal = "wait";
    confidence = "low";
  }

  if (typeof trendStrengthScore === "number" && Math.abs(trendStrengthScore) >= 6) {
    if (signal !== "pullback_in_uptrend" && signal !== "bounce_in_downtrend") {
      confidence = "high";
    }
  } else if (
    typeof trendStrengthScore === "number" &&
    Math.abs(trendStrengthScore) >= 3 &&
    confidence === "low"
  ) {
    confidence = "medium";
  }

  return {
    ok: true,
    reason: "signal_summary_ready",
    signal,
    confidence,
  };
}

function buildSummaryMeta(summary = {}) {
  const marketBiasOk = summary?.marketBias?.ok === true;
  const momentumBiasOk = summary?.momentumBias?.ok === true;
  const trendStrengthOk = summary?.trendStrength?.ok === true;
  const signalSummaryOk = summary?.signalSummary?.ok === true;

  return {
    version: COINGECKO_INDICATORS_VERSION,
    layer: "summary",
    componentsReady: {
      marketBias: marketBiasOk,
      momentumBias: momentumBiasOk,
      trendStrength: trendStrengthOk,
      signalSummary: signalSummaryOk,
    },
    readyCount: [marketBiasOk, momentumBiasOk, trendStrengthOk, signalSummaryOk]
      .filter(Boolean)
      .length,
  };
}

export function buildIndicatorSummary(indicators = {}) {
  const marketBias = buildMarketBias(indicators);
  const momentumBias = buildMomentumBias(indicators);

  const partialSummary = {
    marketBias,
    momentumBias,
  };

  const trendStrength = buildTrendStrength(indicators, partialSummary);
  const signalSummary = buildSignalSummary({
    ...partialSummary,
    trendStrength,
  });

  const summaryOk =
    marketBias.ok === true &&
    momentumBias.ok === true &&
    trendStrength.ok === true &&
    signalSummary.ok === true;

  const summary = {
    ok: summaryOk,
    reason: summaryOk
      ? "indicator_summary_ready"
      : "indicator_summary_partial",
    version: COINGECKO_INDICATORS_VERSION,
    marketBias,
    momentumBias,
    trendStrength,
    signalSummary,
  };

  return {
    ...summary,
    meta: buildSummaryMeta(summary),
  };
}

export function buildIndicatorBundle(input = {}) {
  const prices = normalizePriceSeries(input?.prices || []);
  const emaPeriod = normalizePositiveInt(input?.emaPeriod, 20);
  const rsiPeriod = normalizePositiveInt(input?.rsiPeriod, 14);
  const emaSlowPeriod = normalizePositiveInt(input?.emaSlowPeriod, 50);

  const indicators = {
    ema20: computeEma(prices, emaPeriod),
    ema50: computeEma(prices, emaSlowPeriod),
    emaCross: computeEmaCross(prices, emaPeriod, emaSlowPeriod),
    rsi14: computeRsi(prices, rsiPeriod),
    macd: computeMacd(prices),
  };

  const indicatorsReady =
    indicators.ema20.ok === true &&
    indicators.ema50.ok === true &&
    indicators.emaCross.ok === true &&
    indicators.rsi14.ok === true &&
    indicators.macd.ok === true;

  const summary = buildIndicatorSummary(indicators);

  return {
    ok: indicatorsReady && summary.ok === true,
    version: COINGECKO_INDICATORS_VERSION,
    reason:
      indicatorsReady && summary.ok === true
        ? "indicator_bundle_ready"
        : "indicator_bundle_partial",
    indicatorsReady,
    inputMeta: buildSeriesMeta(prices),
    indicators,
    summary,
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
  const marketBias = bundle.summary?.marketBias;
  const momentumBias = bundle.summary?.momentumBias;
  const trendStrength = bundle.summary?.trendStrength;
  const signalSummary = bundle.summary?.signalSummary;

  const lines = [
    "COINGECKO INDICATORS:",
    `- version: ${COINGECKO_INDICATORS_VERSION}`,
    `- prices_count: ${bundle.inputMeta.count}`,
    `- first_ts: ${bundle.inputMeta.firstTs ?? "n/a"}`,
    `- last_ts: ${bundle.inputMeta.lastTs ?? "n/a"}`,
    `- indicators_ready: ${bundle.indicatorsReady === true ? "true" : "false"}`,
    `- bundle_ok: ${bundle.ok === true ? "true" : "false"}`,
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
    `- market_bias_status: ${marketBias?.reason ?? "n/a"}`,
    `- market_bias_signal: ${marketBias?.signal ?? "n/a"}`,
    `- momentum_bias_status: ${momentumBias?.reason ?? "n/a"}`,
    `- momentum_bias_signal: ${momentumBias?.signal ?? "n/a"}`,
    `- trend_strength_status: ${trendStrength?.reason ?? "n/a"}`,
    `- trend_strength_score: ${trendStrength?.score ?? "n/a"}`,
    `- trend_strength_signal: ${trendStrength?.signal ?? "n/a"}`,
    `- signal_summary_status: ${signalSummary?.reason ?? "n/a"}`,
    `- signal_summary_signal: ${signalSummary?.signal ?? "n/a"}`,
    `- signal_summary_confidence: ${signalSummary?.confidence ?? "n/a"}`,
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
  buildIndicatorSummary,
  buildIndicatorBundle,
  buildCoingeckoIndicatorsDebugText,
};