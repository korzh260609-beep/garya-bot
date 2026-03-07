/**
 * Decision Validator
 *
 * Responsibility:
 * - validates route shape
 * - validates worker result shape
 * - validates judge result shape
 * - returns warnings only
 *
 * IMPORTANT:
 * - sandbox only
 * - no production integration
 * - no side effects
 */

const KNOWN_ROUTE_KINDS = new Set([
  "chat_simple",
  "chat_complex",
  "task_execution",
  "source_query",
  "repo_analysis",
  "system_diag",
  "unknown",
]);

export function validateDecisionRoute(route = {}) {
  const warnings = [];

  if (!route || typeof route !== "object") {
    warnings.push("validator_route_missing");
    return warnings;
  }

  if (!route.kind) {
    warnings.push("validator_route_kind_missing");
  } else if (!KNOWN_ROUTE_KINDS.has(route.kind)) {
    warnings.push("validator_route_kind_unknown");
  }

  if (!route.workerType) {
    warnings.push("validator_route_worker_type_missing");
  }

  if (typeof route.judgeRequired !== "boolean") {
    warnings.push("validator_route_judge_required_invalid");
  }

  return warnings;
}

export function validateDecisionWorkerResult(workerResult = {}) {
  const warnings = [];

  if (!workerResult || typeof workerResult !== "object") {
    warnings.push("validator_worker_result_missing");
    return warnings;
  }

  if (typeof workerResult.ok !== "boolean") {
    warnings.push("validator_worker_ok_invalid");
  }

  if (!Array.isArray(workerResult.facts)) {
    warnings.push("validator_worker_facts_invalid");
  }

  if (
    workerResult.draft !== null &&
    workerResult.draft !== undefined &&
    typeof workerResult.draft !== "string"
  ) {
    warnings.push("validator_worker_draft_invalid");
  }

  if (
    workerResult.warnings !== undefined &&
    !Array.isArray(workerResult.warnings)
  ) {
    warnings.push("validator_worker_warnings_invalid");
  }

  return warnings;
}

export function validateDecisionJudgeResult(judgeResult = {}) {
  const warnings = [];

  if (!judgeResult || typeof judgeResult !== "object") {
    warnings.push("validator_judge_result_missing");
    return warnings;
  }

  if (typeof judgeResult.ok !== "boolean") {
    warnings.push("validator_judge_ok_invalid");
  }

  if (typeof judgeResult.approved !== "boolean") {
    warnings.push("validator_judge_approved_invalid");
  }

  if (
    judgeResult.finalText !== null &&
    judgeResult.finalText !== undefined &&
    typeof judgeResult.finalText !== "string"
  ) {
    warnings.push("validator_judge_final_text_invalid");
  }

  if (
    judgeResult.warnings !== undefined &&
    !Array.isArray(judgeResult.warnings)
  ) {
    warnings.push("validator_judge_warnings_invalid");
  }

  if (
    judgeResult.reason !== null &&
    judgeResult.reason !== undefined &&
    typeof judgeResult.reason !== "string"
  ) {
    warnings.push("validator_judge_reason_invalid");
  }

  return warnings;
}