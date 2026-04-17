// ============================================================================
// === src/core/stageCheck/real/realStatusEvaluator.js
// === evaluates universal real_status from collected real evidence
// === rule-based statuses + probability/confidence layer
// === with explain/diagnostic output for exact item review
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

  for (const item of toArray(realEvidence?.connectedness?.repoReferenceMatches)) {
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

function isRuntimeFoundationScope(realEvidence) {
  return (
    hasScopeTag(realEvidence, "runtime") ||
    hasScopeTag(realEvidence, "transport")
  );
}

function isFoundationDomainScope(realEvidence) {
  return (
    hasScopeTag(realEvidence, "runtime") ||
    hasScopeTag(realEvidence, "transport") ||
    hasScopeTag(realEvidence, "database") ||
    hasScopeTag(realEvidence, "access") ||
    hasScopeTag(realEvidence, "identity") ||
    hasScopeTag(realEvidence, "memory") ||
    hasScopeTag(realEvidence, "sources")
  );
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
    Math.min(distinctImplementationAnchors, 4);

  const coverageScore = clamp01(
    breadthSignals / Math.max(coverageDenominator, 1)
  );

  const foundationSignalScore =
    strongRuntimeFoundationCount * 1.0 +
    mediumRuntimeFoundationCount * 0.65 +
    Math.min(distinctImplementationAnchors, 4) * 0.45 +
    Math.min(repoRefFiles, 4) * 0.35;

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
    foundationSignalScore,
  };
}

function buildProbabilityLayer(summary, realEvidence) {
  let score = 0;

  score += Math.min(summary.candidateCount, 4) * 0.11;
  score += Math.min(summary.directEntrypointCount, 3) * 0.2;
  score += Math.min(summary.repoRefFiles, 4) * 0.09;
  score += Math.min(summary.strongRuntimeFoundationCount, 5) * 0.09;
  score += Math.min(summary.mediumRuntimeFoundationCount, 4) * 0.04;
  score += summary.coverageScore * 0.24;
  score += Math.min(summary.nonDescriptiveDomainFiles, 3) * 0.02;

  if (summary.scopeStats.isLargeScope && summary.distinctDirectCandidates < 2) {
    score -= 0.1;
  }

  if (summary.scopeStats.isVeryLargeScope && summary.coverageScore < 0.3) {
    score -= 0.12;
  }

  if (
    summary.hasContextOnlyEvidence &&
    !isRuntimeFoundationScope(realEvidence)
  ) {
    score -= 0.12;
  }

  if (
    isFoundationDomainScope(realEvidence) &&
    summary.foundationSignalScore >= 2.3
  ) {
    score += 0.1;
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
    if (summary.hasRuntimeReachability) {
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
      isFoundationDomainScope(realEvidence) &&
      summary.foundationSignalScore >= 2.3 &&
      !summary.hasRuntimeReachability
    ) {
      return "runtime_foundation_partially_proven";
    }

    if (
      summary.hasCandidateAnchor &&
      (summary.hasRepoReachability || summary.runtimeFoundationCount > 0)
    ) {
      return "implementation_exists_but_runtime_connectedness_is_incomplete";
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

function pushRule(diag, name, passed, details = {}) {
  diag.rules.push({
    name,
    passed: !!passed,
    details,
  });
}

function buildDiagnosticsBase(summary, probability, realEvidence) {
  return {
    evaluator: "exact_item_real_status_v2_explain",
    scopeTags: Array.isArray(realEvidence?.scopeSemanticProfile?.tags)
      ? realEvidence.scopeSemanticProfile.tags
      : [],
    isFoundationDomain: isFoundationDomainScope(realEvidence),
    isRuntimeFoundation: isRuntimeFoundationScope(realEvidence),
    metrics: {
      scopeItemCount: Number(summary.scopeStats.scopeItemCount || 0),
      exactItems: Number(summary.scopeStats.exactItems || 0),
      stageItems: Number(summary.scopeStats.stageItems || 0),
      isLargeScope: !!summary.scopeStats.isLargeScope,
      isVeryLargeScope: !!summary.scopeStats.isVeryLargeScope,

      candidateCount: summary.candidateCount,
      directEntrypointCount: summary.directEntrypointCount,
      repoRefFiles: summary.repoRefFiles,
      runtimeFoundationCount: summary.runtimeFoundationCount,
      strongRuntimeFoundationCount: summary.strongRuntimeFoundationCount,
      mediumRuntimeFoundationCount: summary.mediumRuntimeFoundationCount,
      domainEvidenceCount: summary.domainEvidenceCount,
      distinctDomainFiles: summary.distinctDomainFiles,
      nonDescriptiveDomainFiles: summary.nonDescriptiveDomainFiles,
      distinctDirectCandidates: summary.distinctDirectCandidates,
      distinctRepoReferencedCandidates: summary.distinctRepoReferencedCandidates,
      distinctImplementationAnchors: summary.distinctImplementationAnchors,
      coverageScore: round3(summary.coverageScore),
      foundationSignalScore: round3(summary.foundationSignalScore),
      probabilityScore: probability.score,
      probabilityBand: probability.band,

      hasCandidateAnchor: summary.hasCandidateAnchor,
      hasRuntimeReachability: summary.hasRuntimeReachability,
      hasRepoReachability: summary.hasRepoReachability,
      hasImplementationEvidence: summary.hasImplementationEvidence,
      hasContextOnlyEvidence: summary.hasContextOnlyEvidence,
    },
    rules: [],
    chosenRule: null,
  };
}

export function evaluateRealStatus({
  realEvidence,
} = {}) {
  const summary = buildImplementationSummary(realEvidence);
  const probability = buildProbabilityLayer(summary, realEvidence);
  const diagnostics = buildDiagnosticsBase(summary, probability, realEvidence);

  let status = "UNKNOWN";

  const smallOrMediumScope = !summary.scopeStats.isLargeScope;
  const largeScope = summary.scopeStats.isLargeScope;
  const foundationDomain = isFoundationDomainScope(realEvidence);
  const runtimeFoundationScope = isRuntimeFoundationScope(realEvidence);

  const completeByReachabilitySmallScope =
    smallOrMediumScope &&
    summary.hasCandidateAnchor &&
    summary.hasRuntimeReachability &&
    probability.score >= 0.72;

  pushRule(diagnostics, "complete_by_reachability_small_scope", completeByReachabilitySmallScope, {
    smallOrMediumScope,
    hasCandidateAnchor: summary.hasCandidateAnchor,
    hasRuntimeReachability: summary.hasRuntimeReachability,
    probabilityScore: probability.score,
    requiredProbabilityScore: 0.72,
  });

  const completeByReachabilityLargeScope =
    largeScope &&
    summary.hasCandidateAnchor &&
    summary.hasRuntimeReachability &&
    summary.distinctDirectCandidates >= 2 &&
    summary.coverageScore >= 0.32 &&
    probability.score >= 0.74;

  pushRule(diagnostics, "complete_by_reachability_large_scope", completeByReachabilityLargeScope, {
    largeScope,
    hasCandidateAnchor: summary.hasCandidateAnchor,
    hasRuntimeReachability: summary.hasRuntimeReachability,
    distinctDirectCandidates: summary.distinctDirectCandidates,
    requiredDistinctDirectCandidates: 2,
    coverageScore: round3(summary.coverageScore),
    requiredCoverageScore: 0.32,
    probabilityScore: probability.score,
    requiredProbabilityScore: 0.74,
  });

  const completeByFoundationOnly =
    !summary.hasCandidateAnchor &&
    !summary.hasRepoReachability &&
    runtimeFoundationScope &&
    summary.strongRuntimeFoundationCount >= 5 &&
    summary.runtimeFoundationCount >= 6 &&
    probability.score >= 0.8;

  pushRule(diagnostics, "complete_by_foundation_only", completeByFoundationOnly, {
    hasCandidateAnchor: summary.hasCandidateAnchor,
    hasRepoReachability: summary.hasRepoReachability,
    runtimeFoundationScope,
    strongRuntimeFoundationCount: summary.strongRuntimeFoundationCount,
    requiredStrongRuntimeFoundationCount: 5,
    runtimeFoundationCount: summary.runtimeFoundationCount,
    requiredRuntimeFoundationCount: 6,
    probabilityScore: probability.score,
    requiredProbabilityScore: 0.8,
  });

  if (
    completeByReachabilitySmallScope ||
    completeByReachabilityLargeScope ||
    completeByFoundationOnly
  ) {
    status = "COMPLETE";
    diagnostics.chosenRule = completeByReachabilitySmallScope
      ? "complete_by_reachability_small_scope"
      : completeByReachabilityLargeScope
        ? "complete_by_reachability_large_scope"
        : "complete_by_foundation_only";
  } else {
    const partialByImplementation =
      summary.hasCandidateAnchor &&
      (summary.hasRepoReachability || summary.runtimeFoundationCount > 0) &&
      probability.score >= 0.36;

    pushRule(diagnostics, "partial_by_implementation", partialByImplementation, {
      hasCandidateAnchor: summary.hasCandidateAnchor,
      hasRepoReachability: summary.hasRepoReachability,
      runtimeFoundationCount: summary.runtimeFoundationCount,
      probabilityScore: probability.score,
      requiredProbabilityScore: 0.36,
    });

    const partialByLargeScopeReachability =
      largeScope &&
      summary.hasRuntimeReachability &&
      summary.distinctDirectCandidates >= 1 &&
      probability.score >= 0.4;

    pushRule(diagnostics, "partial_by_large_scope_reachability", partialByLargeScopeReachability, {
      largeScope,
      hasRuntimeReachability: summary.hasRuntimeReachability,
      distinctDirectCandidates: summary.distinctDirectCandidates,
      requiredDistinctDirectCandidates: 1,
      probabilityScore: probability.score,
      requiredProbabilityScore: 0.4,
    });

    const partialByFoundation =
      foundationDomain &&
      !summary.hasRuntimeReachability &&
      summary.foundationSignalScore >= 2.3 &&
      summary.runtimeFoundationCount >= 2 &&
      probability.score >= 0.34;

    pushRule(diagnostics, "partial_by_foundation", partialByFoundation, {
      foundationDomain,
      hasRuntimeReachability: summary.hasRuntimeReachability,
      foundationSignalScore: round3(summary.foundationSignalScore),
      requiredFoundationSignalScore: 2.3,
      runtimeFoundationCount: summary.runtimeFoundationCount,
      requiredRuntimeFoundationCount: 2,
      probabilityScore: probability.score,
      requiredProbabilityScore: 0.34,
    });

    const partialByImplementedButNarrowScope =
      summary.hasImplementationEvidence &&
      !summary.hasRuntimeReachability &&
      summary.distinctImplementationAnchors >= 2 &&
      probability.score >= 0.34;

    pushRule(
      diagnostics,
      "partial_by_implemented_but_narrow_scope",
      partialByImplementedButNarrowScope,
      {
        hasImplementationEvidence: summary.hasImplementationEvidence,
        hasRuntimeReachability: summary.hasRuntimeReachability,
        distinctImplementationAnchors: summary.distinctImplementationAnchors,
        requiredDistinctImplementationAnchors: 2,
        probabilityScore: probability.score,
        requiredProbabilityScore: 0.34,
        warning:
          "this rule is the main suspect for false positives on non-foundation items",
      }
    );

    if (
      partialByImplementation ||
      partialByLargeScopeReachability ||
      partialByFoundation ||
      partialByImplementedButNarrowScope
    ) {
      status = "PARTIAL";
      diagnostics.chosenRule = partialByImplementation
        ? "partial_by_implementation"
        : partialByLargeScopeReachability
          ? "partial_by_large_scope_reachability"
          : partialByFoundation
            ? "partial_by_foundation"
            : "partial_by_implemented_but_narrow_scope";
    } else if (
      summary.hasCandidateAnchor ||
      summary.hasRepoReachability ||
      summary.runtimeFoundationCount > 0 ||
      summary.domainEvidenceCount > 0
    ) {
      status = "OPEN";
      diagnostics.chosenRule = "fallback_open_by_some_evidence";
    } else {
      status = "UNKNOWN";
      diagnostics.chosenRule = "fallback_unknown_no_meaningful_evidence";
    }
  }

  const enrichedConnectedness = {
    ...(summary.connectedness || {}),
    scopeStats: summary.scopeStats,
    distinctDirectCandidates: summary.distinctDirectCandidates,
    distinctRepoReferencedCandidates: summary.distinctRepoReferencedCandidates,
    distinctImplementationAnchors: summary.distinctImplementationAnchors,
    coverageScore: round3(summary.coverageScore),
    foundationSignalScore: round3(summary.foundationSignalScore),
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
    diagnostics,
  });
}

export default {
  evaluateRealStatus,
};
