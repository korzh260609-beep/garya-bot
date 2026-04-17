// ============================================================================
// === src/core/stageCheck/real/realStatusEvaluator.js
// === evaluates universal real_status from collected real evidence
// === rule-based statuses + probability/confidence layer
// ============================================================================

import { createRealReview } from "../contracts/stageCheckTypes.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function round3(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function countRuntimeFoundationEvidence(realEvidence) {
  return toArray(realEvidence?.runtimeFoundationEvidence).length;
}

function countStrongRuntimeFoundationEvidence(realEvidence) {
  return toArray(realEvidence?.runtimeFoundationEvidence).filter(
    (x) => String(x?.strength || "") === "strong"
  ).length;
}

function countMediumRuntimeFoundationEvidence(realEvidence) {
  return toArray(realEvidence?.runtimeFoundationEvidence).filter(
    (x) => String(x?.strength || "") === "medium"
  ).length;
}

function countDomainEvidence(realEvidence) {
  return toArray(realEvidence?.domainEvidence).length;
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

function countDistinctDirectCandidates(realEvidence) {
  const matches = toArray(realEvidence?.connectedness?.directEntrypointMatches);
  const candidates = matches
    .map((x) => String(x?.candidate || "").trim())
    .filter(Boolean);

  return new Set(candidates).size;
}

function countDistinctRepoReferencedCandidates(realEvidence) {
  const matches = toArray(realEvidence?.connectedness?.repoReferenceMatches);
  const candidates = matches
    .map((x) => String(x?.candidate || "").trim())
    .filter(Boolean);

  return new Set(candidates).size;
}

function countDistinctImplementationAnchors(realEvidence) {
  const files = new Set();

  for (const path of toArray(realEvidence?.connectedness?.candidateFiles)) {
    const file = String(path || "").trim();
    if (file) files.add(file);
  }

  for (const item of toArray(realEvidence?.runtimeFoundationEvidence)) {
    const file = String(item?.file || "").trim();
    if (file) files.add(file);
  }

  return files.size;
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

function getScopeStats(realEvidence) {
  const stats = realEvidence?.scopeStats || {};
  return {
    scopeItemCount: Number(stats.scopeItemCount || 0),
    exactItems: Number(stats.exactItems || 0),
    stageItems: Number(stats.stageItems || 0),
    isLargeScope: !!stats.isLargeScope,
    isVeryLargeScope: !!stats.isVeryLargeScope,
  };
}

function buildImplementationSummary(realEvidence) {
  const connectedness = realEvidence?.connectedness || {};
  const scopeStats = getScopeStats(realEvidence);

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
  const mediumRuntimeFoundationCount =
    countMediumRuntimeFoundationEvidence(realEvidence);

  const domainEvidenceCount = countDomainEvidence(realEvidence);
  const distinctDomainFiles = countDistinctDomainFiles(realEvidence);
  const nonDescriptiveDomainFiles = countNonDescriptiveDomainFiles(realEvidence);

  const distinctDirectCandidates = countDistinctDirectCandidates(realEvidence);
  const distinctRepoReferencedCandidates =
    countDistinctRepoReferencedCandidates(realEvidence);
  const distinctImplementationAnchors =
    countDistinctImplementationAnchors(realEvidence);

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

  const coverageDenominator =
    scopeStats.exactItems > 0
      ? scopeStats.exactItems
      : scopeStats.scopeItemCount > 0
        ? scopeStats.scopeItemCount
        : 1;

  const breadthSignals =
    distinctDirectCandidates +
    distinctRepoReferencedCandidates +
    Math.min(distinctImplementationAnchors, 3);

  const coverageScore = clamp01(breadthSignals / Math.max(coverageDenominator, 1));

  return {
    connectedness,
    scopeStats,
    candidateCount,
    directEntrypointCount,
    repoRefFiles,
    runtimeFoundationCount,
    strongRuntimeFoundationCount,
    mediumRuntimeFoundationCount,
    domainEvidenceCount,
    distinctDomainFiles,
    nonDescriptiveDomainFiles,
    distinctDirectCandidates,
    distinctRepoReferencedCandidates,
    distinctImplementationAnchors,
    hasCandidateAnchor,
    hasRuntimeReachability,
    hasRepoReachability,
    hasImplementationEvidence,
    hasContextOnlyEvidence,
    coverageScore,
  };
}

function buildProbabilityLayer(summary, realEvidence) {
  let score = 0;

  // implementation evidence
  score += Math.min(summary.candidateCount, 4) * 0.12;
  score += Math.min(summary.directEntrypointCount, 3) * 0.24;
  score += Math.min(summary.repoRefFiles, 4) * 0.10;
  score += Math.min(summary.strongRuntimeFoundationCount, 5) * 0.10;
  score += Math.min(summary.mediumRuntimeFoundationCount, 4) * 0.04;

  // breadth / coverage
  score += summary.coverageScore * 0.30;

  // weak contextual support only
  score += Math.min(summary.nonDescriptiveDomainFiles, 3) * 0.03;

  // penalties for large scopes with narrow proof
  if (summary.scopeStats.isLargeScope && summary.distinctDirectCandidates < 2) {
    score -= 0.16;
  }

  if (summary.scopeStats.isVeryLargeScope && summary.coverageScore < 0.35) {
    score -= 0.18;
  }

  if (
    summary.hasContextOnlyEvidence &&
    !isRuntimeFoundationScope(realEvidence)
  ) {
    score -= 0.12;
  }

  score = clamp01(score);

  let band = "low";
  if (score >= 0.75) band = "high";
  else if (score >= 0.45) band = "medium";

  return {
    score: round3(score),
    band,
  };
}

function buildRealReason({
  status,
  summary,
  realEvidence,
  probability,
}) {
  if (status === "COMPLETE") {
    if (summary.scopeStats.isLargeScope) {
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
      summary.runtimeFoundationCount >= 3
    ) {
      return "runtime_foundation_partially_proven";
    }

    if (probability.band === "medium" || probability.band === "high") {
      return "some_real_connectedness_detected";
    }

    return "implementation_artifacts_not_connected_to_runtime";
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
  const probability = buildProbabilityLayer(summary, realEvidence);

  let status = "UNKNOWN";

  const smallOrMediumScope = !summary.scopeStats.isLargeScope;
  const largeScope = summary.scopeStats.isLargeScope;

  const completeByReachabilitySmallScope =
    smallOrMediumScope &&
    summary.hasCandidateAnchor &&
    summary.hasRuntimeReachability &&
    probability.score >= 0.72;

  const completeByReachabilityLargeScope =
    largeScope &&
    summary.hasCandidateAnchor &&
    summary.hasRuntimeReachability &&
    summary.distinctDirectCandidates >= 2 &&
    summary.coverageScore >= 0.35 &&
    probability.score >= 0.78;

  const completeByFoundationOnly =
    !summary.hasCandidateAnchor &&
    !summary.hasRepoReachability &&
    isRuntimeFoundationScope(realEvidence) &&
    summary.strongRuntimeFoundationCount >= 5 &&
    summary.runtimeFoundationCount >= 6 &&
    probability.score >= 0.80;

  if (
    completeByReachabilitySmallScope ||
    completeByReachabilityLargeScope ||
    completeByFoundationOnly
  ) {
    status = "COMPLETE";
  } else {
    const partialByImplementation =
      summary.hasCandidateAnchor &&
      (summary.hasRepoReachability || summary.runtimeFoundationCount > 0) &&
      probability.score >= 0.42;

    const partialByLargeScopeReachability =
      largeScope &&
      summary.hasRuntimeReachability &&
      summary.distinctDirectCandidates >= 1 &&
      probability.score >= 0.46;

    const partialByFoundation =
      !summary.hasCandidateAnchor &&
      !summary.hasRepoReachability &&
      isRuntimeFoundationScope(realEvidence) &&
      summary.runtimeFoundationCount >= 3 &&
      probability.score >= 0.48;

    if (
      partialByImplementation ||
      partialByLargeScopeReachability ||
      partialByFoundation
    ) {
      status = "PARTIAL";
    } else if (
      summary.hasCandidateAnchor ||
      summary.hasRepoReachability ||
      summary.runtimeFoundationCount > 0 ||
      summary.domainEvidenceCount > 0
    ) {
      status = "OPEN";
    } else {
      status = "UNKNOWN";
    }
  }

  const enrichedConnectedness = {
    ...(summary.connectedness || {}),
    scopeStats: summary.scopeStats,
    distinctDirectCandidates: summary.distinctDirectCandidates,
    distinctRepoReferencedCandidates: summary.distinctRepoReferencedCandidates,
    distinctImplementationAnchors: summary.distinctImplementationAnchors,
    coverageScore: round3(summary.coverageScore),
    probabilityScore: probability.score,
    probabilityBand: probability.band,
  };

  return createRealReview({
    status,
    reason: buildRealReason({
      status,
      summary,
      realEvidence,
      probability,
    }),
    evidence: realEvidence?.evidence || [],
    connectedness: enrichedConnectedness,
  });
}

export default {
  evaluateRealStatus,
};
