// src/sources/coingeckoIndicatorsSummary.js
// ============================================================================
// STAGE 10C.21
// SUMMARY LAYER
//
// PURPOSE:
// - transforms ready indicators into summary state
// - interpretation only
// - no orchestration here
// ============================================================================

import {
  COINGECKO_INDICATORS_VERSION,
  getScoreConfidence,
} from "./coingeckoIndicatorsCore.js";

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

  const scoreConfidence = getScoreConfidence(trendStrengthScore);

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
    confidence = scoreConfidence === "high" ? "high" : "medium";
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
    confidence = scoreConfidence === "high" ? "high" : "medium";
  } else if (
    marketBullish &&
    momentumBearish &&
    (trendStrengthSignal === "bullish" ||
      trendStrengthSignal === "slightly_bullish" ||
      trendStrengthSignal === "strong_bullish")
  ) {
    signal = "pullback_in_uptrend";
    confidence = scoreConfidence;
  } else if (
    marketBearish &&
    momentumBullish &&
    (trendStrengthSignal === "bearish" ||
      trendStrengthSignal === "slightly_bearish" ||
      trendStrengthSignal === "strong_bearish")
  ) {
    signal = "bounce_in_downtrend";
    confidence = scoreConfidence;
  } else if (
    trendStrengthSignal === "slightly_bullish" ||
    trendStrengthSignal === "slightly_bearish"
  ) {
    signal = "wait";
    confidence = scoreConfidence === "high" ? "medium" : "low";
  } else if (trendStrengthSignal === "neutral") {
    signal = "wait";
    confidence = "low";
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

export default {
  buildIndicatorSummary,
};