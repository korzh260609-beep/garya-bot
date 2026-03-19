// src/sources/coingeckoIndicatorsEntryHints.js
// ============================================================================
// STAGE 10C.21
// ENTRY HINTS LAYER
//
// PURPOSE:
// - interpretation only
// - no execution logic
// - no TP/SL
// - no trading engine
// ============================================================================

import {
  clampReadinessScore,
  getReadinessLabel,
  getPriorityFromReadiness,
  getConfidenceScoreNormalized,
  getAttentionLevel,
  getStateTag,
  buildEntrySummaryLine,
} from "./coingeckoIndicatorsCore.js";

export function buildEntryHints(summary = {}) {
  const marketBias = summary?.marketBias;
  const momentumBias = summary?.momentumBias;
  const trendStrength = summary?.trendStrength;
  const signalSummary = summary?.signalSummary;

  const result = {
    ok: false,
    reason: "entry_hints_inputs_not_ready",
    hint: null,
    bias: null,
    confidence: null,
    confidenceScoreNormalized: null,
    attentionLevel: null,
    context: null,
    setup: null,
    triggerStatus: null,
    actionBias: null,
    riskMode: null,
    readinessScore: null,
    readinessLabel: null,
    priority: null,
    stateTag: null,
    shouldWaitForConfirmation: null,
    summaryLine: null,
    explanationShort: null,
    note: null,
  };

  if (
    !marketBias?.ok ||
    !momentumBias?.ok ||
    !trendStrength?.ok ||
    !signalSummary?.ok
  ) {
    return result;
  }

  const summarySignal = signalSummary.signal || null;
  const summaryConfidence = signalSummary.confidence || "low";
  const trendSignal = trendStrength.signal || null;
  const trendScore = trendStrength.score;
  const marketSignal = marketBias.signal || null;
  const momentumSignal = momentumBias.signal || null;

  let hint = "no_entry_hint";
  let bias = "neutral";
  let context = "mixed";
  let setup = "no_clear_setup";
  let triggerStatus = "not_ready";
  let actionBias = "hold";
  let riskMode = "defensive";
  let readinessScore = 10;
  let readinessLabel = "low";
  let priority = "low";
  let stateTag = "wait_mixed";
  let attentionLevel = "low";
  let shouldWaitForConfirmation = true;
  let summaryLine = null;
  let confidenceScoreNormalized = getConfidenceScoreNormalized(summaryConfidence);
  let explanationShort = "No clear setup right now.";
  let note = "No clear entry hint from current summary state.";

  if (summarySignal === "pullback_in_uptrend") {
    hint = "possible_buy_on_dip";
    bias = "bullish";
    context = "trend_continuation_pullback";
    setup = "buy_the_dip_setup";
    triggerStatus =
      summaryConfidence === "high" ? "early_confirmation" : "not_ready";
    actionBias = "accumulate";
    riskMode = summaryConfidence === "high" ? "balanced" : "defensive";
    readinessScore = summaryConfidence === "high" ? 62 : 38;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Uptrend is intact, but current dip still needs confirmation.";
    note =
      "Bullish structure remains, but momentum is pulling back. Watch for dip stabilization, not blind entry.";
  } else if (summarySignal === "bounce_in_downtrend") {
    hint = "possible_sell_on_bounce";
    bias = "bearish";
    context = "trend_continuation_bounce";
    setup = "sell_the_bounce_setup";
    triggerStatus =
      summaryConfidence === "high" ? "early_confirmation" : "not_ready";
    actionBias = "reduce";
    riskMode = summaryConfidence === "high" ? "balanced" : "defensive";
    readinessScore = summaryConfidence === "high" ? 62 : 38;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Downtrend is intact, but current bounce still needs confirmation.";
    note =
      "Bearish structure remains, but momentum is bouncing. Watch for bounce weakness, not blind entry.";
  } else if (summarySignal === "buy") {
    hint = "possible_buy_with_trend";
    bias = "bullish";
    context = "trend_alignment";
    setup = "trend_buy_setup";
    triggerStatus = "confirmed";
    actionBias = "accumulate";
    riskMode = "aggressive";
    readinessScore = 88;
    shouldWaitForConfirmation = false;
    explanationShort = "Trend and momentum are aligned upward.";
    note = "Trend and momentum are aligned to the upside.";
  } else if (summarySignal === "buy_watch") {
    hint = "possible_buy_with_trend";
    bias = "bullish";
    context = "trend_alignment";
    setup = "trend_buy_setup";
    triggerStatus = "early_confirmation";
    actionBias = "accumulate";
    riskMode = "balanced";
    readinessScore = 68;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Bullish structure exists, but confirmation is still partial.";
    note =
      "Bullish structure exists, but confirmation is weaker than full buy state.";
  } else if (summarySignal === "sell") {
    hint = "possible_sell_with_trend";
    bias = "bearish";
    context = "trend_alignment";
    setup = "trend_sell_setup";
    triggerStatus = "confirmed";
    actionBias = "reduce";
    riskMode = "aggressive";
    readinessScore = 88;
    shouldWaitForConfirmation = false;
    explanationShort = "Trend and momentum are aligned downward.";
    note = "Trend and momentum are aligned to the downside.";
  } else if (summarySignal === "sell_watch") {
    hint = "possible_sell_with_trend";
    bias = "bearish";
    context = "trend_alignment";
    setup = "trend_sell_setup";
    triggerStatus = "early_confirmation";
    actionBias = "reduce";
    riskMode = "balanced";
    readinessScore = 68;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Bearish structure exists, but confirmation is still partial.";
    note =
      "Bearish structure exists, but confirmation is weaker than full sell state.";
  } else if (summarySignal === "wait") {
    hint = "wait_for_confirmation";
    bias =
      trendSignal === "slightly_bullish"
        ? "slightly_bullish"
        : trendSignal === "slightly_bearish"
          ? "slightly_bearish"
          : "neutral";
    context = "weak_or_mixed";
    setup = "no_clear_setup";
    triggerStatus = "not_ready";
    actionBias = "hold";
    riskMode = "defensive";
    readinessScore = 18;
    shouldWaitForConfirmation = true;
    explanationShort = "Market structure is mixed. Better wait.";
    note =
      "Structure is not clean enough. Better wait for stronger confirmation before any entry idea.";
  }

  if (
    hint === "possible_buy_on_dip" &&
    trendScore !== null &&
    trendScore <= 0
  ) {
    triggerStatus = "not_ready";
    actionBias = "hold";
    riskMode = "defensive";
    readinessScore = 24;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Possible dip idea exists, but trend strength is too weak.";
    note =
      "Signal looks like a pullback, but trend strength is weak. Treat buy-on-dip idea cautiously.";
  }

  if (
    hint === "possible_sell_on_bounce" &&
    trendScore !== null &&
    trendScore >= 0
  ) {
    triggerStatus = "not_ready";
    actionBias = "hold";
    riskMode = "defensive";
    readinessScore = 24;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Possible bounce-sell idea exists, but trend strength is too weak.";
    note =
      "Signal looks like a bounce, but trend strength is weak. Treat sell-on-bounce idea cautiously.";
  }

  readinessScore = clampReadinessScore(readinessScore);
  readinessLabel = getReadinessLabel(readinessScore);
  priority = getPriorityFromReadiness(readinessScore);
  confidenceScoreNormalized = getConfidenceScoreNormalized(summaryConfidence);
  attentionLevel = getAttentionLevel({
    triggerStatus,
    readinessLabel,
  });
  stateTag = getStateTag({
    bias,
    triggerStatus,
    readinessLabel,
    shouldWaitForConfirmation,
  });
  summaryLine = buildEntrySummaryLine({
    bias,
    setup,
    triggerStatus,
    readinessLabel,
    shouldWaitForConfirmation,
  });

  return {
    ok: true,
    reason: "entry_hints_ready",
    hint,
    bias,
    confidence: summaryConfidence,
    confidenceScoreNormalized,
    attentionLevel,
    context,
    setup,
    triggerStatus,
    actionBias,
    riskMode,
    readinessScore,
    readinessLabel,
    priority,
    stateTag,
    shouldWaitForConfirmation,
    summaryLine,
    explanationShort,
    note,
    basedOn: {
      marketBias: marketSignal,
      momentumBias: momentumSignal,
      trendStrength: trendSignal,
      signalSummary: summarySignal,
    },
  };
}

export default {
  buildEntryHints,
};