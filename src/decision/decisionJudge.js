/**
 * Decision Layer — Judge
 *
 * Responsibility:
 * - accepts worker result
 * - selects judge by route.kind
 * - validates / approves output
 * - may pass warnings forward
 * - does NOT execute external actions
 * - does NOT wire itself into production behavior yet
 */

import { DECISION_JUDGES } from "./decisionJudges.js";

function normalizeWarnings(...warningGroups) {
  return warningGroups.flat().filter(Boolean);
}

function resolveJudgeType(workerResult) {
  const routeKind = workerResult?.route?.kind || "default";

  if (!routeKind || routeKind === "unknown") {
    return "default";
  }

  return routeKind;
}

export async function judgeDecisionResult(workerResult, context) {
  const judgeType = resolveJudgeType(workerResult);

  const judge =
    DECISION_JUDGES[judgeType] ||
    DECISION_JUDGES.default;

  const judgeResult = await judge(workerResult, context);

  return {
    ok: judgeResult?.ok ?? true,
    approved: judgeResult?.approved ?? true,
    finalText: judgeResult?.finalText || null,
    warnings: normalizeWarnings(
      judgeType in DECISION_JUDGES ? [] : ["judge_type_not_found"],
      judgeResult?.warnings || []
    ),
    reason: judgeResult?.reason || "judge_not_defined",
  };
}