/**
 * Decision Result Contract
 *
 * Responsibility:
 * - normalizes final Decision Layer result
 * - keeps one stable output shape
 * - contains NO production integration
 * - contains NO external side effects
 */

function normalizeWarnings(...warningGroups) {
  return warningGroups.flat().filter(Boolean);
}

export function createDecisionResult(data = {}) {
  const context = data.context || null;
  const route = data.route || null;
  const workerResult = data.workerResult || null;
  const judgeResult = data.judgeResult || null;
  const trace = data.trace || null;

  return {
    ok: Boolean(route) && Boolean(workerResult?.ok) && Boolean(judgeResult?.ok),
    context,
    route,
    workerResult,
    judgeResult,
    trace,
    finalText: judgeResult?.finalText || null,
    warnings: normalizeWarnings(
      workerResult?.warnings || [],
      judgeResult?.warnings || [],
      data.warnings || []
    ),
  };
}