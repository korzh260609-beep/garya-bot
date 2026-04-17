// ============================================================================
// === src/core/stageCheck/real/realAggregateEvaluator.js
// === aggregates item-level real reviews upward for stages/substages
// === final status = own exact review + child aggregation
// ============================================================================

import { createRealReview } from "../contracts/stageCheckTypes.js";
import { buildScopeSemanticProfile } from "./realScopeProfile.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function round3(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function hasTag(tags, tag) {
  return new Set(toArray(tags)).has(tag);
}

function isFoundationDomainTags(tags = []) {
  return (
    hasTag(tags, "runtime") ||
    hasTag(tags, "transport") ||
    hasTag(tags, "database") ||
    hasTag(tags, "access") ||
    hasTag(tags, "identity") ||
    hasTag(tags, "memory") ||
    hasTag(tags, "sources")
  );
}

function buildReviewMap(itemRealReviews) {
  const map = new Map();

  for (const entry of toArray(itemRealReviews)) {
    const code = String(entry?.item?.code || "").trim();
    if (!code) continue;
    map.set(code, entry);
  }

  return map;
}

function summarizeChildReviews(childEntries = []) {
  let completeCount = 0;
  let partialCount = 0;
  let openCount = 0;
  let unknownCount = 0;

  let implementationChildren = 0;
  let strongChildren = 0;
  let reachabilityChildren = 0;
  let foundationChildren = 0;

  const evidence = [];

  for (const entry of childEntries) {
    const status = String(entry?.review?.status || "UNKNOWN");
    const connectedness = entry?.review?.connectedness || {};

    if (status === "COMPLETE") completeCount += 1;
    else if (status === "PARTIAL") partialCount += 1;
    else if (status === "OPEN") openCount += 1;
    else unknownCount += 1;

    if (status === "COMPLETE" || status === "PARTIAL") {
      implementationChildren += 1;
    }

    if (status === "COMPLETE") {
      strongChildren += 1;
    }

    if (Number(connectedness.directEntrypointCount || 0) > 0) {
      reachabilityChildren += 1;
    }

    if (Number(connectedness.foundationSignalScore || 0) >= 2.3) {
      foundationChildren += 1;
    }

    for (const ev of toArray(entry?.review?.evidence).slice(0, 4)) {
      evidence.push(ev);
    }
  }

  const totalChildren = childEntries.length || 0;
  const implementationRatio =
    totalChildren > 0 ? implementationChildren / totalChildren : 0;

  return {
    totalChildren,
    completeCount,
    partialCount,
    openCount,
    unknownCount,
    implementationChildren,
    strongChildren,
    reachabilityChildren,
    foundationChildren,
    implementationRatio,
    evidence: evidence.slice(0, 24),
  };
}

function chooseBaseOwnReview({
  baseItem,
  itemReviewMap,
}) {
  const code = String(baseItem?.code || "").trim();
  if (!code) return null;
  return itemReviewMap.get(code) || null;
}

function getOwnExactMetrics(baseOwnReview) {
  const review = baseOwnReview?.review || null;
  const connectedness = review?.connectedness || {};

  const ownStatus = String(review?.status || "UNKNOWN");
  const ownProbabilityScore = Number(connectedness.probabilityScore || 0);
  const ownFoundationSignalScore = Number(
    connectedness.foundationSignalScore || 0
  );
  const ownCoverageScore = Number(connectedness.coverageScore || 0);
  const ownDirectEntrypointCount = Number(
    connectedness.directEntrypointCount || 0
  );
  const ownCandidateCount = Number(
    Array.isArray(connectedness.candidateFiles)
      ? connectedness.candidateFiles.length
      : 0
  );
  const ownRepoRefFiles = Number(connectedness.distinctRepoRefFiles || 0);
  const ownImplementationAnchors = Number(
    connectedness.distinctImplementationAnchors || 0
  );

  const ownShowsImplementation =
    ownStatus === "COMPLETE" ||
    ownStatus === "PARTIAL" ||
    ownStatus === "OPEN";

  const ownStrongEnough =
    ownStatus === "COMPLETE" ||
    ownStatus === "PARTIAL" ||
    ownDirectEntrypointCount > 0 ||
    ownFoundationSignalScore >= 2.3 ||
    (
      ownCandidateCount >= 1 &&
      (ownRepoRefFiles >= 1 || ownImplementationAnchors >= 2)
    ) ||
    ownProbabilityScore >= 0.34;

  return {
    ownStatus,
    ownProbabilityScore,
    ownFoundationSignalScore,
    ownCoverageScore,
    ownDirectEntrypointCount,
    ownCandidateCount,
    ownRepoRefFiles,
    ownImplementationAnchors,
    ownShowsImplementation,
    ownStrongEnough,
  };
}

function buildAggregateReason({
  status,
  foundationDomain,
  summary,
  ownMetrics,
}) {
  if (status === "COMPLETE") {
    if (summary.reachabilityChildren > 0 || ownMetrics.ownDirectEntrypointCount > 0) {
      return "reachable_implementation_connected_to_runtime";
    }

    return "real_runtime_and_repository_connectedness_proven";
  }

  if (status === "PARTIAL") {
    if (
      foundationDomain &&
      (
        summary.foundationChildren > 0 ||
        ownMetrics.ownFoundationSignalScore >= 2.3
      )
    ) {
      return "runtime_foundation_partially_proven";
    }

    if (
      ownMetrics.ownShowsImplementation &&
      ownMetrics.ownDirectEntrypointCount === 0 &&
      (
        ownMetrics.ownRepoRefFiles > 0 ||
        ownMetrics.ownImplementationAnchors >= 2
      )
    ) {
      return "implementation_exists_but_runtime_connectedness_is_incomplete";
    }

    return "some_real_connectedness_detected";
  }

  if (status === "OPEN") {
    if (ownMetrics.ownStatus === "OPEN") {
      return "implementation_artifacts_not_connected_to_runtime";
    }
    return "domain_evidence_partially_proven";
  }

  return "insufficient_real_evidence";
}

export function buildAggregatedRealReview({
  baseItem,
  scopeWorkflowItems,
  itemRealReviews,
} = {}) {
  const itemReviewMap = buildReviewMap(itemRealReviews);
  const baseOwnReview = chooseBaseOwnReview({
    baseItem,
    itemReviewMap,
  });

  const list = toArray(scopeWorkflowItems);
  const descendants = list.filter(
    (item) => String(item?.code || "") !== String(baseItem?.code || "")
  );

  const childEntries = descendants
    .map((item) => itemReviewMap.get(String(item?.code || "")))
    .filter(Boolean);

  // exact item or no descendants -> return own exact review as-is
  if (
    String(baseItem?.kind || "").toLowerCase() === "item" ||
    childEntries.length === 0
  ) {
    return (
      baseOwnReview?.review ||
      createRealReview({
        status: "UNKNOWN",
        reason: "insufficient_real_evidence",
        evidence: [],
        connectedness: {
          aggregateMode: "exact_fallback",
        },
      })
    );
  }

  const tags = buildScopeSemanticProfile(scopeWorkflowItems)?.tags || [];
  const foundationDomain = isFoundationDomainTags(tags);
  const summary = summarizeChildReviews(childEntries);
  const ownMetrics = getOwnExactMetrics(baseOwnReview);

  const total = summary.totalChildren;

  const completeEnough =
    summary.completeCount >= Math.max(2, Math.ceil(total * 0.5));
  const activeEnough =
    summary.implementationChildren >= Math.max(2, Math.ceil(total * 0.35));

  let status = "UNKNOWN";

  // COMPLETE:
  // only when child coverage is genuinely broad enough.
  if (
    completeEnough &&
    activeEnough &&
    (
      summary.reachabilityChildren >= 1 ||
      ownMetrics.ownDirectEntrypointCount > 0
    )
  ) {
    status = "COMPLETE";
  } else {
    // FOUNDATION DOMAINS:
    // parent should be PARTIAL if own exact proof is already meaningful,
    // even when child coverage is not yet broad.
    const partialByOwnFoundation =
      foundationDomain &&
      ownMetrics.ownStrongEnough &&
      (
        ownMetrics.ownFoundationSignalScore >= 2.3 ||
        ownMetrics.ownDirectEntrypointCount > 0 ||
        ownMetrics.ownImplementationAnchors >= 2 ||
        ownMetrics.ownProbabilityScore >= 0.34
      );

    const partialByChildFoundation =
      foundationDomain &&
      (
        summary.implementationChildren >= 2 ||
        summary.foundationChildren >= 1 ||
        summary.reachabilityChildren >= 1
      ) &&
      summary.implementationRatio >= 0.10;

    const partialByGeneralChildren =
      !foundationDomain &&
      summary.implementationChildren >= 2 &&
      summary.implementationRatio >= 0.18;

    const partialByStrongChildren =
      summary.strongChildren >= 1 &&
      summary.implementationChildren >= 2;

    const partialByOwnImplementedButNarrow =
      ownMetrics.ownStrongEnough &&
      ownMetrics.ownShowsImplementation &&
      !foundationDomain &&
      (
        ownMetrics.ownDirectEntrypointCount > 0 ||
        ownMetrics.ownImplementationAnchors >= 2
      ) &&
      ownMetrics.ownProbabilityScore >= 0.40;

    if (
      partialByOwnFoundation ||
      partialByChildFoundation ||
      partialByGeneralChildren ||
      partialByStrongChildren ||
      partialByOwnImplementedButNarrow
    ) {
      status = "PARTIAL";
    } else if (
      summary.openCount > 0 ||
      ownMetrics.ownStatus === "OPEN"
    ) {
      status = "OPEN";
    } else {
      status = "UNKNOWN";
    }
  }

  const reason = buildAggregateReason({
    status,
    foundationDomain,
    summary,
    ownMetrics,
  });

  const ownEvidence = toArray(baseOwnReview?.review?.evidence).slice(0, 12);
  const aggregateEvidence = [...ownEvidence, ...summary.evidence].slice(0, 28);

  return createRealReview({
    status,
    reason,
    evidence: aggregateEvidence,
    connectedness: {
      aggregateMode: "own_plus_child_real_aggregation",
      foundationDomain,
      totalChildren: summary.totalChildren,
      completeCount: summary.completeCount,
      partialCount: summary.partialCount,
      openCount: summary.openCount,
      unknownCount: summary.unknownCount,
      implementationChildren: summary.implementationChildren,
      strongChildren: summary.strongChildren,
      reachabilityChildren: summary.reachabilityChildren,
      foundationChildren: summary.foundationChildren,
      implementationRatio: round3(summary.implementationRatio),

      ownExactStatus: ownMetrics.ownStatus,
      ownProbabilityScore: round3(ownMetrics.ownProbabilityScore),
      ownFoundationSignalScore: round3(ownMetrics.ownFoundationSignalScore),
      ownCoverageScore: round3(ownMetrics.ownCoverageScore),
      ownDirectEntrypointCount: ownMetrics.ownDirectEntrypointCount,
      ownCandidateCount: ownMetrics.ownCandidateCount,
      ownRepoRefFiles: ownMetrics.ownRepoRefFiles,
      ownImplementationAnchors: ownMetrics.ownImplementationAnchors,
      ownStrongEnough: ownMetrics.ownStrongEnough,
    },
  });
}

export default {
  buildAggregatedRealReview,
};
