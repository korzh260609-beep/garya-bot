/**
 * Decision Planner Telemetry
 *
 * Responsibility:
 * - runs planner replay in sandbox
 * - analyzes planner replay result
 * - saves compact planner telemetry snapshot
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - no external side effects
 */

import { runDecisionPlannerReplay } from "./decisionPlannerReplay.js";
import { analyzeDecisionPlannerReplay } from "./decisionPlannerCompare.js";
import { saveDecisionTelemetry } from "./decisionTelemetry.js";

function createPlannerTelemetryReplay(replay = {}, analysis = {}) {
  return {
    ok: replay?.ok || false,
    mode: "planner_replay",
    baseline: null,
    shadow: {
      ok: replay?.ok || false,
      mode: "planner_replay",
      durationMs: 0,
      route: null,
      finalText: null,
      warnings: [],
      health: null,
    },
    compare: {
      sameFinalText: false,
      sameRoute: false,
      baselineWarningsCount: 0,
      shadowWarningsCount: analysis?.summary?.failed || 0,
    },
    planner: {
      total: replay?.total || 0,
      passed: replay?.passed || 0,
      failed: replay?.failed || 0,
      passRate: analysis?.summary?.passRate || 0,
      mismatches: analysis?.mismatches || {
        kind: 0,
        workerType: 0,
        requiresJudge: 0,
        requiresAI: 0,
      },
    },
  };
}

export function createDecisionPlannerTelemetryFromReplay(
  replay = {},
  analysisInput = null
) {
  const analysis = analysisInput || analyzeDecisionPlannerReplay(replay);

  const telemetryReplay = createPlannerTelemetryReplay(replay, analysis);
  const record = saveDecisionTelemetry(telemetryReplay, {
    planner: analysis,
  });

  return {
    ok: replay?.ok || false,
    mode: "planner_telemetry",
    replay,
    analysis,
    telemetry: record,
  };
}

export async function saveDecisionPlannerTelemetry() {
  const replay = await runDecisionPlannerReplay();

  return createDecisionPlannerTelemetryFromReplay(replay);
}