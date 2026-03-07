/**
 * Decision Planner Service
 *
 * Responsibility:
 * - provides unified sandbox interface for Decision Planner
 * - aggregates planner modules behind one service layer
 * - does NOT modify production pipeline
 * - does NOT connect into handleMessage
 * - does NOT connect into TelegramAdapter
 *
 * Flow:
 * plan
 * -> replay
 * -> compare
 * -> telemetry
 * -> health
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 * - no side effects outside planner telemetry
 */

import { planDecision } from "./decisionPlanner.js";
import { runDecisionPlannerReplay } from "./decisionPlannerReplay.js";
import { analyzeDecisionPlannerReplay } from "./decisionPlannerCompare.js";
import { saveDecisionPlannerTelemetry } from "./decisionPlannerTelemetry.js";
import { getDecisionPlannerHealth } from "./decisionPlannerHealth.js";

export async function plan(input = {}) {
  return planDecision(input);
}

export async function replay() {
  return runDecisionPlannerReplay();
}

export async function compare() {
  const replayResult = await runDecisionPlannerReplay();
  const analysis = analyzeDecisionPlannerReplay(replayResult);

  return {
    ok: analysis?.ok || false,
    mode: "planner_compare",
    replay: replayResult,
    analysis,
  };
}

export async function telemetry() {
  return saveDecisionPlannerTelemetry();
}

export async function health() {
  const plannerHealth = await getDecisionPlannerHealth();

  return {
    ok: true,
    mode: "planner_health",
    health: plannerHealth,
  };
}

export async function runAll(input = {}) {
  const planResult = await plan(input);
  const replayResult = await replay();
  const compareAnalysis = analyzeDecisionPlannerReplay(replayResult);

  const compareResult = {
    ok: compareAnalysis?.ok || false,
    mode: "planner_compare",
    replay: replayResult,
    analysis: compareAnalysis,
  };

  const telemetryResult = await telemetry();
  const healthResult = await health();

  return {
    ok:
      Boolean(planResult?.ok) &&
      Boolean(replayResult?.ok) &&
      Boolean(compareResult?.ok),
    mode: "planner_service",
    plan: planResult,
    replay: replayResult,
    compare: compareResult,
    telemetry: telemetryResult,
    health: healthResult,
  };
}

const decisionPlannerService = {
  plan,
  replay,
  compare,
  telemetry,
  health,
  runAll,
};

export default decisionPlannerService;