/**
 * Decision Shadow Hook
 *
 * Responsibility:
 * - runs Decision shadow after Core response
 * - collects telemetry
 *
 * IMPORTANT:
 * - sandbox only
 * - must NOT affect production response
 */

import { runDecisionReplay } from "./decisionReplay.js";
import { analyzeDecisionReplay } from "./decisionCompare.js";
import { saveDecisionTelemetry } from "./decisionTelemetry.js";
import { createCoreBaselineSnapshot } from "./coreBaselineAdapter.js";

export async function runDecisionShadowHook(input = {}, coreResult = {}) {
  try {
    const baseline = createCoreBaselineSnapshot(coreResult);

    const replay = await runDecisionReplay(input, baseline);

    const analysis = analyzeDecisionReplay(replay);

    saveDecisionTelemetry(replay, analysis);

    return {
      ok: true,
      baseline,
      replay,
      analysis,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "shadow_hook_failed",
    };
  }
}