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
// - confidence logic improved for trend-strength-aware summary quality
// - entryHints added as a small additive interpretation layer
// - entryHints detail layer extended with setup + triggerStatus
// - entryHints explanationShort added for short human-readable explanation
// - entryHints actionBias added as tiny action interpretation
// - entryHints riskMode added as tiny caution interpretation
// - entryHints readinessScore/readinessLabel/shouldWaitForConfirmation added
// - entryHints priority/summaryLine/confidenceScoreNormalized added
// - entryHints stateTag added
// - entryHints attentionLevel added
// - no trade execution logic
// - no TP/SL engine
// - no chat wiring
// - no SourceService integration yet
// - fail-open
// - accepts parsed market_chart series only
// ============================================================================

import {
  COINGECKO_INDICATORS_VERSION,
  normalizePositiveInt,
  normalizePriceSeries,
  buildSeriesMeta,
  buildIndicatorSkeletonResult,
  computeEma,
  computeEmaCross,
  computeRsi,
  computeMacd,
} from "./coingeckoIndicatorsCore.js";
import { buildIndicatorSummary } from "./coingeckoIndicatorsSummary.js";
import { buildEntryHints } from "./coingeckoIndicatorsEntryHints.js";
import { formatCoingeckoIndicatorsDebugText } from "./coingeckoIndicatorsDebug.js";

export { COINGECKO_INDICATORS_VERSION } from "./coingeckoIndicatorsCore.js";
export { normalizePriceSeries } from "./coingeckoIndicatorsCore.js";
export { buildIndicatorSkeletonResult } from "./coingeckoIndicatorsCore.js";
export { computeEma } from "./coingeckoIndicatorsCore.js";
export { computeEmaCross } from "./coingeckoIndicatorsCore.js";
export { computeRsi } from "./coingeckoIndicatorsCore.js";
export { computeMacd } from "./coingeckoIndicatorsCore.js";
export { buildIndicatorSummary } from "./coingeckoIndicatorsSummary.js";

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
  const entryHints = buildEntryHints(summary);

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
    entryHints,
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

  return formatCoingeckoIndicatorsDebugText(bundle);
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