// src/decision/decisionShadowWindow.js
/**
 * Decision Shadow Window
 *
 * Responsibility:
 * - evaluates decision quality on last N telemetry records
 * - calculates window-based stability stats
 *
 * IMPORTANT:
 * - read-only only
 * - no production routing impact
 * - no promotion decisions here
 * - no DB writes
 */

import { getRecentDecisionTelemetry } from "./decisionTelemetry.js";

function normalizeWindowSize(value, fallback = 20, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function toPercent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

export function evaluateDecisionShadowWindow(windowSize = 20) {
  const limit = normalizeWindowSize(windowSize);
  const records = getRecentDecisionTelemetry(limit);

  const stats = {
    windowSize: limit,
    total: records.length,

    shadowBetter: 0,
    baselineBetter: 0,
    equal: 0,

    shadowBetterPercent: 0,
    baselineBetterPercent: 0,
    equalPercent: 0,
  };

  for (const record of records) {
    const improvement = record?.analysis?.decisionQuality?.improvement || "equal";

    if (improvement === "shadow_better") {
      stats.shadowBetter += 1;
    } else if (improvement === "baseline_better") {
      stats.baselineBetter += 1;
    } else {
      stats.equal += 1;
    }
  }

  stats.shadowBetterPercent = toPercent(stats.shadowBetter, stats.total);
  stats.baselineBetterPercent = toPercent(stats.baselineBetter, stats.total);
  stats.equalPercent = toPercent(stats.equal, stats.total);

  return stats;
}

export default evaluateDecisionShadowWindow;