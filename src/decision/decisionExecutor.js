/**
 * Decision Executor
 *
 * Responsibility:
 * - runs isolated sandbox Decision flow
 * - creates normalized Decision Context
 * - calls Router
 * - calls Worker
 * - optionally calls Judge
 * - returns final normalized result
 *
 * IMPORTANT:
 * - sandbox only
 * - NOT connected to production pipeline
 * - does NOT modify handleMessage
 * - does NOT modify Transport
 * - does NOT execute external side effects
 */

import { createDecisionContext } from "./decisionContext.js";
import { routeDecision } from "./decisionRouter.js";
import { runDecisionWorker } from "./decisionWorker.js";
import { judgeDecisionResult } from "./decisionJudge.js";

function normalizeWarnings(...warningGroups) {
  return warningGroups.flat().filter(Boolean);
}

export async function executeDecision(input = {}) {
  const context = createDecisionContext(input);

  const route = await routeDecision(context);

  const workerResult = await runDecisionWorker(route, context);

  const judgeResult = route?.judgeRequired
    ? await judgeDecisionResult(workerResult, context)
    : {
        ok: true,
        approved: true,
        finalText: workerResult?.draft || null,
        warnings: workerResult?.warnings || [],
        reason: "judge_skipped",
      };

  return {
    ok: Boolean(route) && Boolean(workerResult?.ok) && Boolean(judgeResult?.ok),
    context,
    route,
    workerResult,
    judgeResult,
    finalText: judgeResult?.finalText || null,
    warnings: normalizeWarnings(
      workerResult?.warnings || [],
      judgeResult?.warnings || []
    ),
  };
}