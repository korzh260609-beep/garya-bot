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
import { createDecisionResult } from "./decisionResult.js";
import {
  createDecisionTrace,
  traceRouter,
  traceValidator,
  traceWorker,
  traceJudge,
} from "./decisionTrace.js";
import {
  validateDecisionRoute,
  validateDecisionWorkerResult,
  validateDecisionJudgeResult,
} from "./decisionValidator.js";
import { saveDecisionMemory } from "./decisionMemory.js";

export async function executeDecision(input = {}) {
  const context = createDecisionContext(input);
  const trace = createDecisionTrace();

  const route = await routeDecision(context);
  traceRouter(trace, route);

  const routeWarnings = validateDecisionRoute(route);

  const workerResult = await runDecisionWorker(route, context);
  traceWorker(trace, workerResult);

  const workerWarnings = validateDecisionWorkerResult(workerResult);

  const judgeResult = route?.judgeRequired
    ? await judgeDecisionResult(workerResult, context)
    : {
        ok: true,
        approved: true,
        finalText: workerResult?.draft || null,
        warnings: workerResult?.warnings || [],
        reason: "judge_skipped",
      };

  traceJudge(trace, judgeResult);

  const judgeWarnings = validateDecisionJudgeResult(judgeResult);

  traceValidator(trace, {
    routeWarnings,
    workerWarnings,
    judgeWarnings,
  });

  const result = createDecisionResult({
    context,
    route,
    workerResult,
    judgeResult,
    trace,
    warnings: [
      ...routeWarnings,
      ...workerWarnings,
      ...judgeWarnings,
    ],
  });

  saveDecisionMemory(result);

  return result;
}