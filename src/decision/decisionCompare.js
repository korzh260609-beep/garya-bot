/**
 * Decision Compare
 *
 * Responsibility:
 * - analyzes replay result
 * - evaluates decision differences
 * - provides structured diagnostics
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 */

export function analyzeDecisionReplay(replay = {}) {
  const baseline = replay?.baseline || {};
  const shadow = replay?.shadow || {};

  const sameText = replay?.compare?.sameFinalText || false;
  const sameRoute = replay?.compare?.sameRoute || false;

  const baselineWarnings = replay?.compare?.baselineWarningsCount || 0;
  const shadowWarnings = replay?.compare?.shadowWarningsCount || 0;

  return {
    ok: replay?.ok || false,

    decisionQuality: {
      sameFinalText: sameText,
      sameRoute: sameRoute,
      improvement:
        shadowWarnings < baselineWarnings
          ? "shadow_better"
          : shadowWarnings > baselineWarnings
          ? "baseline_better"
          : "equal",
    },

    warnings: {
      baseline: baselineWarnings,
      shadow: shadowWarnings,
    },

    performance: {
      durationMs: shadow?.durationMs || 0,
    },

    route: {
      baseline: baseline?.route || null,
      shadow: shadow?.route || null,
    },

    health: shadow?.health || null,
  };
}