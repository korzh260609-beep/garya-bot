// src/sources/coingeckoIndicatorsEntryHints.js
// ============================================================================
// STAGE 10C.26
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
    branchReason: null,
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
  let branchReason = "No matching interpretation branch was selected.";
  let note = "No clear entry hint from current summary state.";

  if (summarySignal === "pullback_in_uptrend") {
    hint = "possible_buy_on_dip";
    bias = "bullish";
    context = "trend_continuation_pullback";
    setup = "buy_the_dip_setup";
    triggerStatus =
      summaryConfidence === "high" || summaryConfidence === "medium"
        ? "early_confirmation"
        : "not_ready";
    actionBias = "accumulate";
    riskMode =
      summaryConfidence === "high" || summaryConfidence === "medium"
        ? "balanced"
        : "defensive";
    readinessScore =
      summaryConfidence === "high"
        ? 58
        : summaryConfidence === "medium"
          ? 46
          : 34;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Uptrend is intact, but current dip still needs confirmation.";
    branchReason =
      "signalSummary selected pullback_in_uptrend, so entryHints uses dip-in-uptrend interpretation instead of direct buy.";
    note =
      "Bullish structure remains, but momentum is pulling back. Watch for dip stabilization, not blind entry.";

    if (typeof trendScore === "number") {
      if (trendScore >= 5) {
        triggerStatus =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "early_confirmation"
            : "not_ready";
        riskMode = "balanced";
        readinessScore =
          summaryConfidence === "high"
            ? 66
            : summaryConfidence === "medium"
              ? 52
              : 40;
        explanationShort =
          "Uptrend remains strong, but the pullback still needs confirmation.";
        branchReason =
          "signalSummary is pullback_in_uptrend and trendStrength is strong enough to keep bullish continuation context, but not enough for direct confirmed buy.";
        note =
          "Bullish structure is strong. Watch for pullback stabilization before acting.";
      } else if (trendScore >= 2) {
        triggerStatus =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "early_confirmation"
            : "not_ready";
        riskMode =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "balanced"
            : "defensive";
        readinessScore =
          summaryConfidence === "high"
            ? 58
            : summaryConfidence === "medium"
              ? 46
              : 34;
        branchReason =
          "signalSummary is pullback_in_uptrend with moderate trend strength, so branch stays continuation-pullback and still waits for confirmation.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 24;
        shouldWaitForConfirmation = true;
        explanationShort =
          "Possible dip idea exists, but trend strength is too weak.";
        branchReason =
          "signalSummary points to pullback_in_uptrend, but trendStrength is too weak, so readiness is reduced and no near-ready buy interpretation is allowed.";
        note =
          "Signal looks like a pullback, but trend strength is weak. Treat buy-on-dip idea cautiously.";
      }
    }
  } else if (summarySignal === "bounce_in_downtrend") {
    hint = "possible_sell_on_bounce";
    bias = "bearish";
    context = "trend_continuation_bounce";
    setup = "sell_the_bounce_setup";
    triggerStatus =
      summaryConfidence === "high" || summaryConfidence === "medium"
        ? "early_confirmation"
        : "not_ready";
    actionBias = "reduce";
    riskMode =
      summaryConfidence === "high" || summaryConfidence === "medium"
        ? "balanced"
        : "defensive";
    readinessScore =
      summaryConfidence === "high"
        ? 58
        : summaryConfidence === "medium"
          ? 46
          : 34;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Downtrend is intact, but current bounce still needs confirmation.";
    branchReason =
      "signalSummary selected bounce_in_downtrend, so entryHints uses bounce-in-downtrend interpretation instead of direct sell.";
    note =
      "Bearish structure remains, but momentum is bouncing. Watch for bounce weakness, not blind entry.";

    if (typeof trendScore === "number") {
      if (trendScore <= -5) {
        triggerStatus =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "early_confirmation"
            : "not_ready";
        riskMode = "balanced";
        readinessScore =
          summaryConfidence === "high"
            ? 66
            : summaryConfidence === "medium"
              ? 52
              : 40;
        explanationShort =
          "Downtrend remains strong, but the bounce still needs confirmation.";
        branchReason =
          "signalSummary is bounce_in_downtrend and trendStrength is strong enough to keep bearish continuation context, but not enough for direct confirmed sell.";
        note =
          "Bearish structure is strong. Watch for bounce weakness before acting.";
      } else if (trendScore <= -2) {
        triggerStatus =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "early_confirmation"
            : "not_ready";
        riskMode =
          summaryConfidence === "high" || summaryConfidence === "medium"
            ? "balanced"
            : "defensive";
        readinessScore =
          summaryConfidence === "high"
            ? 58
            : summaryConfidence === "medium"
              ? 46
              : 34;
        branchReason =
          "signalSummary is bounce_in_downtrend with moderate bearish trend strength, so branch stays continuation-bounce and still waits for confirmation.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 24;
        shouldWaitForConfirmation = true;
        explanationShort =
          "Possible bounce-sell idea exists, but trend strength is too weak.";
        branchReason =
          "signalSummary points to bounce_in_downtrend, but trendStrength is too weak, so readiness is reduced and no near-ready sell interpretation is allowed.";
        note =
          "Signal looks like a bounce, but trend strength is weak. Treat sell-on-bounce idea cautiously.";
      }
    }
  } else if (summarySignal === "buy") {
    hint = "possible_buy_with_trend";
    bias = "bullish";
    context = "trend_alignment";
    setup = "trend_buy_setup";
    triggerStatus = "confirmed";
    actionBias = "accumulate";
    riskMode = "balanced";
    readinessScore = 76;
    shouldWaitForConfirmation = false;
    explanationShort = "Trend and momentum are aligned upward.";
    branchReason =
      "signalSummary selected buy, so entryHints treats trend and momentum as already aligned enough for confirmed bullish interpretation.";
    note = "Trend and momentum are aligned to the upside.";

    if (typeof trendScore === "number") {
      if (trendScore >= 8) {
        riskMode = "aggressive";
        readinessScore = 90;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are strongly aligned upward.";
        branchReason =
          "signalSummary is buy and trendStrength is very strong, so branch remains confirmed buy with highest readiness.";
        note = "Bullish alignment is strong and already confirmed.";
      } else if (trendScore >= 6) {
        riskMode = "aggressive";
        readinessScore = 84;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are aligned upward.";
        branchReason =
          "signalSummary is buy and trendStrength is solid, so branch remains confirmed buy with elevated readiness.";
        note = "Bullish alignment is confirmed with solid trend strength.";
      } else {
        riskMode = "balanced";
        readinessScore = 76;
        shouldWaitForConfirmation = false;
        explanationShort =
          "Bullish alignment exists, but trend strength is not at the strongest edge.";
        branchReason =
          "signalSummary is buy, but trendStrength is only moderate for this branch, so interpretation stays confirmed buy without maximum readiness.";
        note =
          "Bullish structure is confirmed, but not at maximum strength. Avoid overconfidence.";
      }
    }
  } else if (summarySignal === "buy_watch") {
    hint = "possible_buy_with_trend";
    bias = "bullish";
    context = "trend_alignment";
    setup = "trend_buy_setup";
    triggerStatus = "early_confirmation";
    actionBias = "accumulate";
    riskMode = "balanced";
    readinessScore = 60;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Bullish structure exists, but confirmation is still partial.";
    branchReason =
      "signalSummary selected buy_watch, so entryHints keeps bullish direction but still requires extra confirmation before treating it as full buy.";
    note =
      "Bullish structure exists, but confirmation is weaker than full buy state.";

    if (typeof trendScore === "number") {
      if (trendScore >= 5) {
        riskMode = "balanced";
        readinessScore = 72;
        explanationShort =
          "Bullish structure is fairly strong, but still needs final confirmation.";
        branchReason =
          "signalSummary is buy_watch and trendStrength is relatively strong, so branch stays near-ready bullish but still not confirmed buy.";
        note =
          "Bullish setup is close to ready, but not yet a full confirmed buy state.";
      } else if (trendScore >= 3) {
        riskMode = "balanced";
        readinessScore = 60;
        explanationShort =
          "Bullish structure exists, but confirmation is still partial.";
        branchReason =
          "signalSummary is buy_watch with moderate trendStrength, so branch remains partial bullish confirmation.";
        note =
          "Bullish structure exists, but confirmation is weaker than full buy state.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 46;
        explanationShort =
          "Bullish watch idea exists, but current trend strength is still modest.";
        branchReason =
          "signalSummary is buy_watch, but trendStrength is weak for near-ready continuation, so readiness is reduced and wait remains required.";
        note =
          "Bullish structure is present, but trend strength is not strong enough to treat it as nearly ready.";
      }
    }
  } else if (summarySignal === "sell") {
    hint = "possible_sell_with_trend";
    bias = "bearish";
    context = "trend_alignment";
    setup = "trend_sell_setup";
    triggerStatus = "confirmed";
    actionBias = "reduce";
    riskMode = "balanced";
    readinessScore = 76;
    shouldWaitForConfirmation = false;
    explanationShort = "Trend and momentum are aligned downward.";
    branchReason =
      "signalSummary selected sell, so entryHints treats trend and momentum as already aligned enough for confirmed bearish interpretation.";
    note = "Trend and momentum are aligned to the downside.";

    if (typeof trendScore === "number") {
      if (trendScore <= -8) {
        riskMode = "aggressive";
        readinessScore = 90;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are strongly aligned downward.";
        branchReason =
          "signalSummary is sell and trendStrength is very strong, so branch remains confirmed sell with highest readiness.";
        note = "Bearish alignment is strong and already confirmed.";
      } else if (trendScore <= -6) {
        riskMode = "aggressive";
        readinessScore = 84;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are aligned downward.";
        branchReason =
          "signalSummary is sell and trendStrength is solid, so branch remains confirmed sell with elevated readiness.";
        note = "Bearish alignment is confirmed with solid trend strength.";
      } else {
        riskMode = "balanced";
        readinessScore = 76;
        shouldWaitForConfirmation = false;
        explanationShort =
          "Bearish alignment exists, but trend strength is not at the strongest edge.";
        branchReason =
          "signalSummary is sell, but trendStrength is only moderate for this branch, so interpretation stays confirmed sell without maximum readiness.";
        note =
          "Bearish structure is confirmed, but not at maximum strength. Avoid overconfidence.";
      }
    }
  } else if (summarySignal === "sell_watch") {
    hint = "possible_sell_with_trend";
    bias = "bearish";
    context = "trend_alignment";
    setup = "trend_sell_setup";
    triggerStatus = "early_confirmation";
    actionBias = "reduce";
    riskMode = "balanced";
    readinessScore = 60;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Bearish structure exists, but confirmation is still partial.";
    branchReason =
      "signalSummary selected sell_watch, so entryHints keeps bearish direction but still requires extra confirmation before treating it as full sell.";
    note =
      "Bearish structure exists, but confirmation is weaker than full sell state.";

    if (typeof trendScore === "number") {
      if (trendScore <= -5) {
        riskMode = "balanced";
        readinessScore = 72;
        explanationShort =
          "Bearish structure is fairly strong, but still needs final confirmation.";
        branchReason =
          "signalSummary is sell_watch and trendStrength is relatively strong, so branch stays near-ready bearish but still not confirmed sell.";
        note =
          "Bearish setup is close to ready, but not yet a full confirmed sell state.";
      } else if (trendScore <= -3) {
        riskMode = "balanced";
        readinessScore = 60;
        explanationShort =
          "Bearish structure exists, but confirmation is still partial.";
        branchReason =
          "signalSummary is sell_watch with moderate bearish trendStrength, so branch remains partial bearish confirmation.";
        note =
          "Bearish structure exists, but confirmation is weaker than full sell state.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 46;
        explanationShort =
          "Bearish watch idea exists, but current trend strength is still modest.";
        branchReason =
          "signalSummary is sell_watch, but trendStrength is weak for near-ready continuation, so readiness is reduced and wait remains required.";
        note =
          "Bearish structure is present, but trend strength is not strong enough to treat it as nearly ready.";
      }
    }
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
    branchReason =
      "signalSummary selected wait, so entryHints avoids directional setup and keeps neutral defensive interpretation.";
    note =
      "Structure is not clean enough. Better wait for stronger confirmation before any entry idea.";

    if (typeof trendScore === "number") {
      if (Math.abs(trendScore) >= 2) {
        readinessScore = 28;
        explanationShort =
          "There is slight directional structure, but it is still too weak for action.";
        branchReason =
          "signalSummary is wait and trendStrength shows only a small directional lean, so branch remains wait with slightly increased readiness only.";
        note =
          "Market has a small directional lean, but confirmation is still not strong enough.";
      } else if (Math.abs(trendScore) === 1) {
        readinessScore = 22;
        explanationShort =
          "There is a weak directional lean, but the setup is still not ready.";
        branchReason =
          "signalSummary is wait and trendStrength is very weak, so branch remains defensive wait with only minimal directional bias.";
        note =
          "A weak directional bias exists, but it is not reliable enough yet.";
      } else {
        readinessScore = 14;
        explanationShort = "Market is mostly neutral or mixed. Better wait.";
        branchReason =
          "signalSummary is wait and trendStrength is neutral, so no directional setup is allowed.";
        note =
          "No clean directional structure is visible. Better wait for a clearer setup.";
      }
    }
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
    branchReason,
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