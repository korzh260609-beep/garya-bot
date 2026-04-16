// ============================================================================
// === src/core/stageCheck/real/realStatusEvaluator.js
// === evaluates universal real_status from collected real evidence
// ============================================================================

import { createRealReview } from "../contracts/stageCheckTypes.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function countRuntimeFoundationEvidence(realEvidence) {
  return toArray(realEvidence?.runtimeFoundationEvidence).length;
}

function countStrongRuntimeFoundationEvidence(realEvidence) {
  return toArray(realEvidence?.runtimeFoundationEvidence).filter(
    (x) => String(x?.strength || "") === "strong"
  ).length;
}

function countDomainEvidence(realEvidence) {
  return toArray(realEvidence?.domainEvidence).length;
}

function countStrongDomainEvidence(realEvidence) {
  return toArray(realEvidence?.domainEvidence).filter(
    (x) => String(x?.strength || "") === "strong"
  ).length;
}

function countDistinctDomainFiles(realEvidence) {
  const files = toArray(realEvidence?.domainEvidence)
    .map((x) => String(x?.file || "").trim())
    .filter(Boolean);

  return new Set(files).size;
}

function countNonDescriptiveDomainFiles(realEvidence) {
  const files = toArray(realEvidence?.domainEvidence)
    .filter((x) => String(x?.proofClass || "") !== "descriptive")
    .map((x) => String(x?.file || "").trim())
    .filter(Boolean);

  return new Set(files).size;
}

function hasScopeTag(realEvidence, tag) {
  const tags = Array.isArray(realEvidence?.scopeSemanticProfile?.tags)
    ? realEvidence.scopeSemanticProfile.tags
    : [];
  return tags.includes(tag);
}

function isRuntimeFoundationScope(realEvidence) {
  return (
    hasScopeTag(realEvidence, "runtime") ||
    hasScopeTag(realEvidence, "transport")
  );
}

function buildImplementationSummary(realEvidence) {
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

  const domainEvidenceCount = countDomainEvidence(realEvidence);
  const strongDomainEvidenceCount = countStrongDomainEvidence(realEvidence);
  const distinctDomainFiles = countDistinctDomainFiles(realEvidence);
  const nonDescriptiveDomainFiles = countNonDescriptiveDomainFiles(realEvidence);

  const hasCandidateAnchor = candidateCount > 0;
  const hasRuntimeReachability = directEntrypointCount > 0;
  const hasRepoReachability = repoRefFiles > 0;

  const hasImplementationEvidence =
    hasCandidateAnchor ||
    hasRuntimeReachability ||
    hasRepoReachability ||
    runtimeFoundationCount > 0;

  const hasContextOnlyEvidence =
    !hasCandidateAnchor &&
    !hasRuntimeReachability &&
    !hasRepoReachability &&
    runtimeFoundationCount === 0 &&
    domainEvidenceCount > 0;

  return {
    connectedness,
    candidateCount,
    directEntrypointCount,
    repoRefFiles,
    runtimeFoundationCount,
    strongRuntimeFoundationCount,
    domainEvidenceCount,
    strongDomainEvidenceCount,
    distinctDomainFiles,
    nonDescriptiveDomainFiles,
    hasCandidateAnchor,
    hasRuntimeReachability,
    hasRepoReachability,
    hasImplementationEvidence,
    hasContextOnlyEvidence,
  };
}

function buildRealReason({
  status,
  summary,
  realEvidence,
}) {
  if (status === "COMPLETE") {
    if (summary.hasCandidateAnchor && summary.hasRuntimeReachability) {
      return "reachable_implementation_connected_to_runtime";
    }

    if (
      isRuntimeFoundationScope(realEvidence) &&
      summary.strongRuntimeFoundationCount >= 5
    ) {
      return "runtime_foundation_strongly_proven";
    }

    return "real_runtime_and_repository_connectedness_proven";
  }

  if (status === "PARTIAL") {
    if (
      summary.hasCandidateAnchor &&
      (summary.hasRepoReachability || summary.runtimeFoundationCount > 0)
    ) {
      return "implementation_exists_but_runtime_connectedness_is_incomplete";
    }

    if (
      isRuntimeFoundationScope(realEvidence) &&
      summary.strongRuntimeFoundationCount >= 3
    ) {
      return "runtime_foundation_partially_proven";
    }

    return "some_real_connectedness_detected";
  }

  if (status === "OPEN") {
    if (summary.hasContextOnlyEvidence) {
      return "domain_evidence_partially_proven";
    }

    if (
      summary.hasCandidateAnchor ||
      summary.runtimeFoundationCount > 0 ||
      summary.hasRepoReachability
    ) {
      return "implementation_artifacts_not_connected_to_runtime";
    }

    return "insufficient_real_evidence";
  }

  if (
    summary.candidateCount === 0 &&
    summary.repoRefFiles === 0 &&
    summary.runtimeFoundationCount === 0 &&
    summary.domainEvidenceCount === 0
  ) {
    return "insufficient_real_evidence";
  }

  return "real_status_unknown";
}

export function evaluateRealStatus({
  realEvidence,
} = {}) {
  const summary = buildImplementationSummary(realEvidence);
  const connectedness = summary.connectedness;

  let status = "UNKNOWN";

  // COMPLETE:
  // only real implementation reachability can prove it.
  if (summary.hasCandidateAnchor && summary.hasRuntimeReachability) {
    status = "COMPLETE";
  } else if (
    !summary.hasCandidateAnchor &&
    !summary.hasRepoReachability &&
    isRuntimeFoundationScope(realEvidence) &&
    summary.strongRuntimeFoundationCount >= 5
  ) {
    // strict fallback only for foundational runtime/transport scopes
    status = "COMPLETE";
  }

  // PARTIAL:
  // needs implementation-side evidence, not domain-only context.
  else if (
    summary.hasCandidateAnchor &&
    (summary.hasRepoReachability || summary.runtimeFoundationCount > 0)
  ) {
    status = "PARTIAL";
  } else if (
    summary.hasCandidateAnchor &&
    summary.directEntrypointCount === 0 &&
    summary.repoRefFiles >= 2
  ) {
    status = "PARTIAL";
  } else if (
    !summary.hasCandidateAnchor &&
    !summary.hasRepoReachability &&
    isRuntimeFoundationScope(realEvidence) &&
    summary.strongRuntimeFoundationCount >= 3 &&
    summary.runtimeFoundationCount >= 4
  ) {
    status = "PARTIAL";
  }

  // OPEN:
  // weak implementation hints or pure domain context stay OPEN.
  else if (summary.hasCandidateAnchor) {
    status = "OPEN";
  } else if (summary.hasRepoReachability) {
    status = "OPEN";
  } else if (summary.runtimeFoundationCount > 0) {
    status = "OPEN";
  } else if (
    summary.domainEvidenceCount > 0 &&
    summary.nonDescriptiveDomainFiles > 0
  ) {
    status = "OPEN";
  } else if (summary.domainEvidenceCount > 0) {
    status = "OPEN";
  } else {
    status = "UNKNOWN";
  }

  return createRealReview({
    status,
    reason: buildRealReason({
      status,
      summary,
      realEvidence,
    }),
    evidence: realEvidence?.evidence || [],
    connectedness,
  });
}

export default {
  evaluateRealStatus,
};