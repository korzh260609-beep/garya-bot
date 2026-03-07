/**
 * Decision Planner Health
 *
 * Responsibility:
 * - provides health diagnostics for Decision Planner sandbox
 * - analyzes planner replay set quality
 * - does NOT modify planner flow
 * - does NOT touch production pipeline
 *
 * IMPORTANT:
 * - sandbox only
 * - read-only diagnostics
 * - no external side effects
 */

import { runDecisionPlannerReplay } from "./decisionPlannerReplay.js";
import { analyzeDecisionPlannerReplay } from "./decisionPlannerCompare.js";

function toSafeRate(value, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Number((value / total).toFixed(4));
}

function createEmptyPlannerHealth() {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    failureRate: 0,
    mismatchRate: {
      kind: 0,
      workerType: 0,
      requiresJudge: 0,
      requiresAI: 0,
    },
    failedScenarioIds: [],
  };
}

export function getDecisionPlannerHealthFromReplay(
  replay = {},
  analysisInput = null
) {
  const analysis = analysisInput || analyzeDecisionPlannerReplay(replay);

  const total = analysis?.summary?.total || 0;
  const passed = analysis?.summary?.passed || 0;
  const failed = analysis?.summary?.failed || 0;

  if (total === 0) {
    return createEmptyPlannerHealth();
  }

  const failedItems = Array.isArray(analysis?.failedItems)
    ? analysis.failedItems
    : [];

  const mismatches = analysis?.mismatches || {};

  return {
    total,
    passed,
    failed,
    passRate: toSafeRate(passed, total),
    failureRate: toSafeRate(failed, total),
    mismatchRate: {
      kind: toSafeRate(mismatches.kind || 0, total),
      workerType: toSafeRate(mismatches.workerType || 0, total),
      requiresJudge: toSafeRate(mismatches.requiresJudge || 0, total),
      requiresAI: toSafeRate(mismatches.requiresAI || 0, total),
    },
    failedScenarioIds: failedItems
      .map((item) => item?.id || null)
      .filter(Boolean),
  };
}

export async function getDecisionPlannerHealth() {
  const replay = await runDecisionPlannerReplay();

  return getDecisionPlannerHealthFromReplay(replay);
}