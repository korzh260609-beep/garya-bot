// ============================================================================
// === src/core/stageCheck/real/realStatusEvaluator.js
// === evaluates universal real_status from collected real evidence
// ============================================================================

import { createRealReview } from "../contracts/stageCheckTypes.js";

function buildRealReason({
  status,
  candidateCount,
  directEntrypointCount,
  repoRefFiles,
}) {
  if (status === "COMPLETE") {
    return "reachable_implementation_connected_to_runtime";
  }

  if (status === "PARTIAL") {
    if (candidateCount > 0 && directEntrypointCount === 0) {
      return "implementation_exists_but_runtime_connectedness_is_incomplete";
    }
    return "some_real_connectedness_detected";
  }

  if (status === "OPEN") {
    return "implementation_artifacts_not_connected_to_runtime";
  }

  if (candidateCount === 0 && repoRefFiles === 0) {
    return "insufficient_real_evidence";
  }

  return "real_status_unknown";
}

export function evaluateRealStatus({
  realEvidence,
} = {}) {
  const connectedness = realEvidence?.connectedness || {};
  const candidateCount = Number(
    Array.isArray(connectedness.candidateFiles)
      ? connectedness.candidateFiles.length
      : 0
  );

  const directEntrypointCount = Number(connectedness.directEntrypointCount || 0);
  const repoRefFiles = Number(connectedness.distinctRepoRefFiles || 0);

  let status = "UNKNOWN";

  if (candidateCount > 0 && directEntrypointCount > 0) {
    status = "COMPLETE";
  } else if (candidateCount > 0 && repoRefFiles >= 1) {
    status = "PARTIAL";
  } else if (candidateCount > 0) {
    status = "OPEN";
  } else if (repoRefFiles > 0 || directEntrypointCount > 0) {
    status = "PARTIAL";
  } else {
    status = "UNKNOWN";
  }

  return createRealReview({
    status,
    reason: buildRealReason({
      status,
      candidateCount,
      directEntrypointCount,
      repoRefFiles,
    }),
    evidence: realEvidence?.evidence || [],
    connectedness,
  });
}

export default {
  evaluateRealStatus,
};