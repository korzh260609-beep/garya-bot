/**
 * Decision Planner Replay
 *
 * Responsibility:
 * - runs Decision Planner on stable replay inputs
 * - compares result with expected planner shape
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - no side effects
 */

import { planDecision } from "./decisionPlanner.js";
import { DECISION_PLANNER_REPLAY_SET } from "./decisionPlannerReplaySet.js";

function comparePlannerResult(result = {}, expected = {}) {
  return {
    sameKind: result?.kind === expected?.kind,
    sameWorkerType: result?.workerType === expected?.workerType,
    sameRequiresJudge:
      Boolean(result?.executionProposal?.requiresJudge) ===
      Boolean(expected?.requiresJudge),
    sameRequiresAI:
      Boolean(result?.executionProposal?.requiresAI) ===
      Boolean(expected?.requiresAI),
  };
}

function isReplayMatch(compare = {}) {
  return (
    compare.sameKind === true &&
    compare.sameWorkerType === true &&
    compare.sameRequiresJudge === true &&
    compare.sameRequiresAI === true
  );
}

export async function runDecisionPlannerReplay(
  replaySet = DECISION_PLANNER_REPLAY_SET
) {
  const items = [];

  for (const scenario of replaySet) {
    const result = await planDecision(scenario?.input || {});
    const compare = comparePlannerResult(result, scenario?.expected || {});
    const matched = isReplayMatch(compare);

    items.push({
      id: scenario?.id || null,
      title: scenario?.title || null,
      input: scenario?.input || {},
      expected: scenario?.expected || {},
      result,
      compare,
      matched,
    });
  }

  const passed = items.filter((item) => item.matched).length;
  const failed = items.length - passed;

  return {
    ok: failed === 0,
    mode: "planner_replay",
    total: items.length,
    passed,
    failed,
    items,
  };
}