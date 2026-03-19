// src/sources/coingeckoIndicatorsEntryHints.js
// ============================================================================
// STAGE 10C.28
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
  let branchReason = "No interpretation branch matched the current summary state.";
  let note = "Current structure does not support a clear entry idea.";

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
          : 38;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Uptrend remains intact, but this dip still needs confirmation.";
    branchReason =
      "signalSummary chose pullback_in_uptrend, so this branch stays bullish but treats the move as a pullback, not a direct buy.";
    note =
      "Structure is still bullish, but momentum is pulling back. Wait for the dip to stabilize before treating it as a stronger continuation signal.";

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
              : 42;
        explanationShort =
          "Uptrend is strong, but the pullback still needs confirmation.";
        branchReason =
          "signalSummary is pullback_in_uptrend and trendStrength is strong, so bullish continuation context stays valid, but this still does not qualify as a direct confirmed buy.";
        note =
          "Bullish structure is strong. The main task is to see whether the pullback stabilizes and resumes with the trend.";
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
              : 38;
        branchReason =
          "signalSummary is pullback_in_uptrend with only moderate trendStrength, so the branch stays continuation-pullback and still waits for extra confirmation.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 28;
        shouldWaitForConfirmation = true;
        explanationShort =
          "A dip idea exists, but trend strength is too weak right now.";
        branchReason =
          "signalSummary points to pullback_in_uptrend, but trendStrength is weak, so readiness is reduced and near-ready bullish interpretation is not allowed.";
        note =
          "This looks more like a possible pullback than a strong continuation setup. Weak trend strength keeps the idea cautious.";
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
          : 38;
    shouldWaitForConfirmation = true;
    explanationShort =
      "Downtrend remains intact, but this bounce still needs confirmation.";
    branchReason =
      "signalSummary chose bounce_in_downtrend, so this branch stays bearish but treats the move as a bounce, not a direct sell.";
    note =
      "Structure is still bearish, but momentum is bouncing. Wait for bounce weakness before treating it as a stronger continuation signal.";

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
              : 42;
        explanationShort =
          "Downtrend is strong, but the bounce still needs confirmation.";
        branchReason =
          "signalSummary is bounce_in_downtrend and trendStrength is strong, so bearish continuation context stays valid, but this still does not qualify as a direct confirmed sell.";
        note =
          "Bearish structure is strong. The main task is to see whether the bounce weakens and rolls back with the trend.";
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
              : 38;
        branchReason =
          "signalSummary is bounce_in_downtrend with only moderate bearish trendStrength, so the branch stays continuation-bounce and still waits for extra confirmation.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 28;
        shouldWaitForConfirmation = true;
        explanationShort =
          "A bounce-sell idea exists, but trend strength is too weak right now.";
        branchReason =
          "signalSummary points to bounce_in_downtrend, but trendStrength is weak, so readiness is reduced and near-ready bearish interpretation is not allowed.";
        note =
          "This looks more like a possible bounce than a strong continuation setup. Weak trend strength keeps the idea cautious.";
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
      "signalSummary chose buy, so this branch treats trend and momentum as aligned enough for a confirmed bullish interpretation.";
    note = "Bullish structure is already aligned and confirmed.";

    if (typeof trendScore === "number") {
      if (trendScore >= 8) {
        riskMode = "aggressive";
        readinessScore = 90;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are strongly aligned upward.";
        branchReason =
          "signalSummary is buy and trendStrength is very strong, so the branch stays confirmed buy with maximum readiness.";
        note = "Bullish alignment is strong and already confirmed.";
      } else if (trendScore >= 6) {
        riskMode = "aggressive";
        readinessScore = 84;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are clearly aligned upward.";
        branchReason =
          "signalSummary is buy and trendStrength is solid, so the branch stays confirmed buy with elevated readiness.";
        note = "Bullish alignment is confirmed with solid trend support.";
      } else {
        riskMode = "balanced";
        readinessScore = 76;
        shouldWaitForConfirmation = false;
        explanationShort =
          "Bullish alignment is present, but not at the strongest level.";
        branchReason =
          "signalSummary is buy, but trendStrength is only moderate for this branch, so interpretation stays confirmed buy without maximum readiness.";
        note =
          "Bullish structure is confirmed, but strength is not at the top edge. Avoid overconfidence.";
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
      "signalSummary chose buy_watch, so this branch keeps bullish direction but still requires extra confirmation before treating it as a full buy.";
    note =
      "Bullish structure is present, but it is still one step below full buy confirmation.";

    if (typeof trendScore === "number") {
      if (trendScore >= 5) {
        riskMode = "balanced";
        readinessScore = 72;
        explanationShort =
          "Bullish structure is fairly strong, but final confirmation is still missing.";
        branchReason =
          "signalSummary is buy_watch and trendStrength is relatively strong, so the branch stays near-ready bullish but still below confirmed buy.";
        note =
          "Bullish setup is close to ready, but it has not crossed into a fully confirmed buy state yet.";
      } else if (trendScore >= 3) {
        riskMode = "balanced";
        readinessScore = 60;
        explanationShort =
          "Bullish structure exists, but confirmation is still partial.";
        branchReason =
          "signalSummary is buy_watch with moderate trendStrength, so the branch remains in partial bullish confirmation.";
        note =
          "Bullish structure is present, but the confirmation quality is still below full buy state.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 46;
        explanationShort =
          "A bullish watch idea exists, but trend strength is still modest.";
        branchReason =
          "signalSummary is buy_watch, but trendStrength is weak for near-ready continuation, so readiness is reduced and waiting remains required.";
        note =
          "Bullish structure is visible, but trend strength is not strong enough to treat this as nearly ready.";
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
      "signalSummary chose sell, so this branch treats trend and momentum as aligned enough for a confirmed bearish interpretation.";
    note = "Bearish structure is already aligned and confirmed.";

    if (typeof trendScore === "number") {
      if (trendScore <= -8) {
        riskMode = "aggressive";
        readinessScore = 90;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are strongly aligned downward.";
        branchReason =
          "signalSummary is sell and trendStrength is very strong, so the branch stays confirmed sell with maximum readiness.";
        note = "Bearish alignment is strong and already confirmed.";
      } else if (trendScore <= -6) {
        riskMode = "aggressive";
        readinessScore = 84;
        shouldWaitForConfirmation = false;
        explanationShort = "Trend and momentum are clearly aligned downward.";
        branchReason =
          "signalSummary is sell and trendStrength is solid, so the branch stays confirmed sell with elevated readiness.";
        note = "Bearish alignment is confirmed with solid trend support.";
      } else {
        riskMode = "balanced";
        readinessScore = 76;
        shouldWaitForConfirmation = false;
        explanationShort =
          "Bearish alignment is present, but not at the strongest level.";
        branchReason =
          "signalSummary is sell, but trendStrength is only moderate for this branch, so interpretation stays confirmed sell without maximum readiness.";
        note =
          "Bearish structure is confirmed, but strength is not at the top edge. Avoid overconfidence.";
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
      "signalSummary chose sell_watch, so this branch keeps bearish direction but still requires extra confirmation before treating it as a full sell.";
    note =
      "Bearish structure is present, but it is still one step below full sell confirmation.";

    if (typeof trendScore === "number") {
      if (trendScore <= -5) {
        riskMode = "balanced";
        readinessScore = 72;
        explanationShort =
          "Bearish structure is fairly strong, but final confirmation is still missing.";
        branchReason =
          "signalSummary is sell_watch and trendStrength is relatively strong, so the branch stays near-ready bearish but still below confirmed sell.";
        note =
          "Bearish setup is close to ready, but it has not crossed into a fully confirmed sell state yet.";
      } else if (trendScore <= -3) {
        riskMode = "balanced";
        readinessScore = 60;
        explanationShort =
          "Bearish structure exists, but confirmation is still partial.";
        branchReason =
          "signalSummary is sell_watch with moderate bearish trendStrength, so the branch remains in partial bearish confirmation.";
        note =
          "Bearish structure is present, but the confirmation quality is still below full sell state.";
      } else {
        triggerStatus = "not_ready";
        actionBias = "hold";
        riskMode = "defensive";
        readinessScore = 46;
        explanationShort =
          "A bearish watch idea exists, but trend strength is still modest.";
        branchReason =
          "signalSummary is sell_watch, but trendStrength is weak for near-ready continuation, so readiness is reduced and waiting remains required.";
        note =
          "Bearish structure is visible, but trend strength is not strong enough to treat this as nearly ready.";
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
    explanationShort = "Market structure is mixed, so waiting is safer.";
    branchReason =
      "signalSummary chose wait, so this branch avoids directional setup and keeps a neutral defensive interpretation.";
    note =
      "The structure is not clean enough yet. A stronger directional signal is still needed before any entry idea becomes useful.";

    if (typeof trendScore === "number") {
      if (Math.abs(trendScore) >= 2) {
        readinessScore = 28;
        explanationShort =
          "There is a slight directional lean, but it is still too weak for action.";
        branchReason =
          "signalSummary is wait and trendStrength shows only a small directional lean, so the branch remains wait with only slightly increased readiness.";
        note =
          "Some directional bias exists, but confirmation is still too weak to support a cleaner setup.";
      } else if (Math.abs(trendScore) === 1) {
        readinessScore = 22;
        explanationShort =
          "There is a weak directional lean, but the setup is still not ready.";
        branchReason =
          "signalSummary is wait and trendStrength is very weak, so the branch stays defensive with only minimal directional bias.";
        note =
          "A weak directional bias is present, but it is still not reliable enough to build on.";
      } else {
        readinessScore = 14;
        explanationShort = "Market is mostly neutral or mixed, so waiting is safer.";
        branchReason =
          "signalSummary is wait and trendStrength is neutral, so no directional setup is allowed.";
        note =
          "No clean directional structure is visible yet. Waiting remains the safer interpretation.";
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