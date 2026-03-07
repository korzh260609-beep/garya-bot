/**
 * Decision Trace
 *
 * Responsibility:
 * - collect internal execution trace
 * - provide debug visibility for Decision Layer
 * - sandbox only
 *
 * IMPORTANT:
 * - no production logging
 * - no side effects
 */

export function createDecisionTrace() {
  return {
    createdAt: Date.now(),

    router: null,
    worker: null,
    judge: null,

    warnings: [],
  };
}

export function traceRouter(trace, route) {
  trace.router = {
    kind: route?.kind || null,
    workerType: route?.workerType || null,
    judgeRequired: route?.judgeRequired || false,
    reason: route?.reason || null,
  };
}

export function traceWorker(trace, workerResult) {
  trace.worker = {
    ok: workerResult?.ok || false,
    factsCount: workerResult?.facts?.length || 0,
    warnings: workerResult?.warnings || [],
  };
}

export function traceJudge(trace, judgeResult) {
  trace.judge = {
    approved: judgeResult?.approved || false,
    reason: judgeResult?.reason || null,
  };
}