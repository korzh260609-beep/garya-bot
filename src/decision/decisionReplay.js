/**
 * Decision Replay
 *
 * Responsibility:
 * - runs Decision Shadow for a given input
 * - attaches expected/current external result snapshot
 * - provides compare-friendly replay object
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 * - no handleMessage integration
 * - no TelegramAdapter integration
 * - no side effects
 */

import { runDecisionShadow } from "./decisionShadowRunner.js";

function normalizeWarnings(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return value == null ? null : String(value);
}

export async function runDecisionReplay(input = {}, baseline = {}) {
  const shadow = await runDecisionShadow(input);

  return {
    ok: shadow?.ok || false,
    mode: "replay",
    input,
    baseline: {
      finalText: normalizeText(baseline?.finalText),
      route: baseline?.route || null,
      warnings: normalizeWarnings(baseline?.warnings),
      source: baseline?.source || "core",
    },
    shadow: {
      ok: shadow?.ok || false,
      mode: shadow?.mode || "shadow",
      durationMs: shadow?.durationMs || 0,
      route: shadow?.route || null,
      finalText: normalizeText(shadow?.finalText),
      warnings: normalizeWarnings(shadow?.warnings),
      health: shadow?.health || null,
    },
    compare: {
      sameFinalText:
        normalizeText(baseline?.finalText) === normalizeText(shadow?.finalText),
      sameRoute:
        JSON.stringify(baseline?.route || null) ===
        JSON.stringify(shadow?.route || null),
      baselineWarningsCount: normalizeWarnings(baseline?.warnings).length,
      shadowWarningsCount: normalizeWarnings(shadow?.warnings).length,
    },
    raw: shadow?.raw || null,
  };
}