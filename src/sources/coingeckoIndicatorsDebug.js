// src/sources/coingeckoIndicatorsDebug.js
// ============================================================================
// STAGE 10C.21
// DEBUG LAYER
//
// PURPOSE:
// - debug/output formatting only
// - no indicator math here
// - no summary construction here
// - no entry decision logic here
// ============================================================================

import { COINGECKO_INDICATORS_VERSION } from "./coingeckoIndicatorsCore.js";

export function formatCoingeckoIndicatorsDebugText(bundle = {}) {
  const ema20 = bundle?.indicators?.ema20 || {};
  const ema50 = bundle?.indicators?.ema50 || {};
  const emaCross = bundle?.indicators?.emaCross || {};
  const rsi14 = bundle?.indicators?.rsi14 || {};
  const macd = bundle?.indicators?.macd || {};
  const marketBias = bundle?.summary?.marketBias;
  const momentumBias = bundle?.summary?.momentumBias;
  const trendStrength = bundle?.summary?.trendStrength;
  const signalSummary = bundle?.summary?.signalSummary;
  const entryHints = bundle?.entryHints;
  const inputMeta = bundle?.inputMeta || {};

  const lines = [
    "COINGECKO INDICATORS:",
    `- version: ${COINGECKO_INDICATORS_VERSION}`,
    `- prices_count: ${inputMeta.count ?? "n/a"}`,
    `- first_ts: ${inputMeta.firstTs ?? "n/a"}`,
    `- last_ts: ${inputMeta.lastTs ?? "n/a"}`,
    `- indicators_ready: ${bundle?.indicatorsReady === true ? "true" : "false"}`,
    `- bundle_ok: ${bundle?.ok === true ? "true" : "false"}`,
    `- ema20_status: ${ema20.reason ?? "n/a"}`,
    `- ema20_latest: ${ema20.output?.latest?.value ?? "n/a"}`,
    `- ema20_signal: ${ema20.output?.signal ?? "n/a"}`,
    `- ema50_status: ${ema50.reason ?? "n/a"}`,
    `- ema50_latest: ${ema50.output?.latest?.value ?? "n/a"}`,
    `- ema50_signal: ${ema50.output?.signal ?? "n/a"}`,
    `- ema_cross_status: ${emaCross.reason ?? "n/a"}`,
    `- ema_cross_latest_spread: ${emaCross.output?.latest?.spread ?? "n/a"}`,
    `- ema_cross_signal: ${emaCross.output?.signal ?? "n/a"}`,
    `- rsi14_status: ${rsi14.reason ?? "n/a"}`,
    `- rsi14_latest: ${rsi14.output?.latest?.value ?? "n/a"}`,
    `- rsi14_signal: ${rsi14.output?.signal ?? "n/a"}`,
    `- macd_status: ${macd.reason ?? "n/a"}`,
    `- macd_latest_macd: ${macd.output?.latest?.macd ?? "n/a"}`,
    `- macd_latest_signal: ${macd.output?.latest?.signal ?? "n/a"}`,
    `- macd_latest_histogram: ${macd.output?.latest?.histogram ?? "n/a"}`,
    `- macd_signal: ${macd.output?.signal ?? "n/a"}`,
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
    `- entry_hints_status: ${entryHints?.reason ?? "n/a"}`,
    `- entry_hints_hint: ${entryHints?.hint ?? "n/a"}`,
    `- entry_hints_bias: ${entryHints?.bias ?? "n/a"}`,
    `- entry_hints_confidence: ${entryHints?.confidence ?? "n/a"}`,
    `- entry_hints_confidence_score_normalized: ${entryHints?.confidenceScoreNormalized ?? "n/a"}`,
    `- entry_hints_attention_level: ${entryHints?.attentionLevel ?? "n/a"}`,
    `- entry_hints_context: ${entryHints?.context ?? "n/a"}`,
    `- entry_hints_setup: ${entryHints?.setup ?? "n/a"}`,
    `- entry_hints_trigger_status: ${entryHints?.triggerStatus ?? "n/a"}`,
    `- entry_hints_action_bias: ${entryHints?.actionBias ?? "n/a"}`,
    `- entry_hints_risk_mode: ${entryHints?.riskMode ?? "n/a"}`,
    `- entry_hints_readiness_score: ${entryHints?.readinessScore ?? "n/a"}`,
    `- entry_hints_readiness_label: ${entryHints?.readinessLabel ?? "n/a"}`,
    `- entry_hints_priority: ${entryHints?.priority ?? "n/a"}`,
    `- entry_hints_state_tag: ${entryHints?.stateTag ?? "n/a"}`,
    `- entry_hints_should_wait: ${entryHints?.shouldWaitForConfirmation ?? "n/a"}`,
    `- entry_hints_summary_line: ${entryHints?.summaryLine ?? "n/a"}`,
    `- entry_hints_explanation_short: ${entryHints?.explanationShort ?? "n/a"}`,
    `- entry_hints_note: ${entryHints?.note ?? "n/a"}`,
  ];

  return lines.join("\n");
}

export default {
  formatCoingeckoIndicatorsDebugText,
};