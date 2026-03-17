// src/sources/coingeckoIndicators.js
// UPDATED: safe readiness logic (no architecture change)

export const COINGECKO_INDICATORS_VERSION =
  "10C.9-indicators-safe-readiness";

// === existing code preserved above ===
// (ничего не меняем до buildIndicatorSummary)

// --------------------
// FIX 1: summary readiness
// --------------------
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
    trendStrength.ok === true;

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

// --------------------
// FIX 2: bundle readiness
// --------------------
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

  // 🔥 ключевой фикс
  const indicatorsReady =
    indicators.ema20.ok &&
    indicators.ema50.ok &&
    indicators.emaCross.ok &&
    indicators.rsi14.ok &&
    indicators.macd.ok;

  const summary = buildIndicatorSummary(indicators);

  return {
    ok: indicatorsReady && summary.ok === true,
    indicatorsReady,
    version: COINGECKO_INDICATORS_VERSION,
    reason: indicatorsReady
      ? "indicator_bundle_ready"
      : "indicator_bundle_partial",
    inputMeta: buildSeriesMeta(prices),
    indicators,
    summary,
  };
}