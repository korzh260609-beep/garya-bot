// src/sources/coingeckoIndicatorsCore.js
// ============================================================================
// STAGE 10C.21
// CORE LAYER
//
// PURPOSE:
// - home for core indicator utilities and raw indicator calculations
// - no orchestration here
// - no summary layer here
// - no debug layer here
// - may expose tiny shared interpretation helpers used by higher layers
//
// RULES:
// - no chat wiring
// - no SourceService wiring
// - fail-open
// ============================================================================

export const COINGECKO_INDICATORS_VERSION =
  "10C.21-entry-hints-attention-level-pack-v1";

function normalizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizePositiveInt(value, fallback) {
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

export function buildSeriesMeta(series = []) {
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

export function getScoreConfidence(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "low";
  const absScore = Math.abs(score);

  if (absScore >= 6) return "high";
  if (absScore >= 3) return "medium";
  return "low";
}

export function clampReadinessScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 100) return 100;
  return Math.round(n);
}

export function getReadinessLabel(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "low";
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getPriorityFromReadiness(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return "low";
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getConfidenceScoreNormalized(confidence) {
  if (confidence === "high") return 100;
  if (confidence === "medium") return 65;
  return 30;
}

export function getAttentionLevel({ triggerStatus, readinessLabel }) {
  const safeTriggerStatus = triggerStatus || "not_ready";
  const safeReadinessLabel = readinessLabel || "low";

  if (safeTriggerStatus === "confirmed" || safeReadinessLabel === "high") {
    return "high";
  }

  if (
    safeTriggerStatus === "early_confirmation" ||
    safeReadinessLabel === "medium"
  ) {
    return "medium";
  }

  return "low";
}

export function getStateTag({
  bias,
  triggerStatus,
  readinessLabel,
  shouldWaitForConfirmation,
}) {
  const safeBias = bias || "neutral";
  const safeTriggerStatus = triggerStatus || "not_ready";
  const safeReadinessLabel = readinessLabel || "low";

  if (safeTriggerStatus === "confirmed" && shouldWaitForConfirmation === false) {
    if (safeBias === "bullish") return "trend_ready_bullish";
    if (safeBias === "bearish") return "trend_ready_bearish";
    return "ready_neutral";
  }

  if (safeTriggerStatus === "early_confirmation") {
    if (safeBias === "bullish") return "building_bullish";
    if (safeBias === "bearish") return "building_bearish";
    return "building_neutral";
  }

  if (safeReadinessLabel === "low" && shouldWaitForConfirmation === true) {
    if (safeBias === "bullish") return "watch_pullback_bullish";
    if (safeBias === "bearish") return "watch_bounce_bearish";
    return "wait_mixed";
  }

  return "wait_mixed";
}

export function buildEntrySummaryLine({
  bias,
  setup,
  triggerStatus,
  readinessLabel,
  shouldWaitForConfirmation,
}) {
  const safeBias = bias || "neutral";
  const safeSetup = setup || "no_clear_setup";
  const safeTriggerStatus = triggerStatus || "not_ready";
  const safeReadinessLabel = readinessLabel || "low";
  const waitPart = shouldWaitForConfirmation ? "wait_confirmation" : "ready_now";

  return `${safeBias} | ${safeSetup} | ${safeTriggerStatus} | readiness:${safeReadinessLabel} | ${waitPart}`;
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

export default {
  COINGECKO_INDICATORS_VERSION,
  normalizePositiveInt,
  normalizePriceSeries,
  buildSeriesMeta,
  getScoreConfidence,
  clampReadinessScore,
  getReadinessLabel,
  getPriorityFromReadiness,
  getConfidenceScoreNormalized,
  getAttentionLevel,
  getStateTag,
  buildEntrySummaryLine,
  buildIndicatorSkeletonResult,
  computeEma,
  computeEmaCross,
  computeRsi,
  computeMacd,
};