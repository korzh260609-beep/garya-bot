// ============================================================================
// === src/core/stageCheck/real/realStatusEvaluator.js
// === evaluates universal real_status from collected real evidence
// ============================================================================

import { createRealReview } from "../contracts/stageCheckTypes.js";

function countRuntimeFoundationEvidence(realEvidence) {
  return Array.isArray(realEvidence?.runtimeFoundationEvidence)
    ? realEvidence.runtimeFoundationEvidence.length
    : 0;
}

function countStrongRuntimeFoundationEvidence(realEvidence) {
  return (Array.isArray(realEvidence?.runtimeFoundationEvidence)
    ? realEvidence.runtimeFoundationEvidence
    : []
  ).filter((x) => String(x?.strength || "") === "strong").length;
}

function buildRealReason({
  status,
  candidateCount,
  directEntrypointCount,
  repoRefFiles,
  runtimeFoundationCount,
  strongRuntimeFoundationCount,
}) {
  if (status === "COMPLETE") {
    if (directEntrypointCount > 0) {
      return "reachable_implementation_connected_to_runtime";
    }

    if (strongRuntimeFoundationCount >= 3) {
      return "runtime_foundation_strongly_proven";
    }

    return "real_runtime_and_repository_connectedness_proven";
  }

  if (status === "PARTIAL") {
    if (candidateCount > 0 && directEntrypointCount === 0) {
      return "implementation_exists_but_runtime_connectedness_is_incomplete";
    }

    if (runtimeFoundationCount > 0) {
      return "runtime_foundation_partially_proven";
    }

    return "some_real_connectedness_detected";
  }

  if (status === "OPEN") {
    return "implementation_artifacts_not_connected_to_runtime";
  }

  if (
    candidateCount === 0 &&
    repoRefFiles === 0 &&
    runtimeFoundationCount === 0
  ) {
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
  const runtimeFoundationCount = countRuntimeFoundationEvidence(realEvidence);
  const strongRuntimeFoundationCount =
    countStrongRuntimeFoundationEvidence(realEvidence);

  let status = "UNKNOWN";

  if (candidateCount > 0 && directEntrypointCount > 0) {
    status = "COMPLETE";
  } else if (
    candidateCount > 0 &&
    (repoRefFiles >= 1 || runtimeFoundationCount >= 1)
  ) {
    status = "PARTIAL";
  } else if (strongRuntimeFoundationCount >= 4) {
    status = "COMPLETE";
  } else if (runtimeFoundationCount >= 2) {
    status = "PARTIAL";
  } else if (candidateCount > 0 || runtimeFoundationCount === 1) {
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
      runtimeFoundationCount,
      strongRuntimeFoundationCount,
    }),
    evidence: realEvidence?.evidence || [],
    connectedness,
  });
}

export default {
  evaluateRealStatus,
};