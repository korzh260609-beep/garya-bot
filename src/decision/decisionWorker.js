/**
 * Decision Layer — Worker
 *
 * Responsibility:
 * - accepts route result from Router
 * - selects worker by route.workerType
 * - prepares facts / draft
 * - does NOT finalize response
 * - does NOT validate final quality
 * - does NOT replace existing handleMessage flow
 */

import { DECISION_WORKERS } from "./decisionWorkers.js";

function normalizeWarnings(...warningGroups) {
  return warningGroups.flat().filter(Boolean);
}

export async function runDecisionWorker(route, context) {
  const workerType = route?.workerType || "none";

  const worker =
    DECISION_WORKERS[workerType] || DECISION_WORKERS.none;

  const workerResult = await worker(route, context);

  return {
    ok: workerResult?.ok ?? true,
    route,
    facts: workerResult?.facts || [],
    draft: workerResult?.draft || null,
    warnings: normalizeWarnings(
      workerType in DECISION_WORKERS ? [] : ["worker_type_not_found"],
      workerResult?.warnings || []
    ),
  };
}