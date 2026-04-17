// ============================================================================
// === src/core/stageCheck/real/realAggregateEvaluator.js
// === aggregates item-level real reviews upward for stages/substages
// === final status = own exact review + child aggregation
// === with explain/diagnostic output for aggregate review
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
    hasTag(tags, "sources") ||
    hasTag(tags, "tasks")
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

  let activeChildren = 0;
  let reachabilityChildren = 0;
  let strongFoundationChildren = 0;
  let partialFoundationChildren = 0;

  const evidence = [];

  for (const entry of childEntries) {
    const status = String(entry?.review?.status || "UNKNOWN");
    const connectedness = entry?.review?.connectedness || {};

    if (status === "COMPLETE") completeCount += 1;
    else if (status === "PARTIAL") partialCount += 1;
    else if (status === "OPEN") openCount += 1;
    else unknownCount += 1;

    if (status === "COMPLETE" || status === "PARTIAL" || status === "OPEN") {
      activeChildren += 1;
    }

    if (Number(connectedness.directEntrypointCount || 0) > 0) {
      reachabilityChildren += 1;
    }

    if (Number(connectedness.foundationSignalScore || 0) >= 2.3) {
      strongFoundationChildren += 1;
    }

    if (
      status === "PARTIAL" &&
      Number(connectedness.foundationSignalScore || 0) >= 2.3
    ) {
      partialFoundationChildren += 1;
    }

    for (const ev of toArray(entry?.review?.evidence).slice(0, 4)) {
      evidence.push(ev);
    }
  }

  const totalChildren = childEntries.length || 0;
  const activeRatio = totalChildren > 0 ? activeChildren / totalChildren : 0;
  const partialOrBetterCount = completeCount + partialCount;

  return {
    totalChildren,
    completeCount,
    partialCount,
    partialOrBetterCount,
    openCount,
    unknownCount,
    activeChildren,
    activeRatio,
    reachabilityChildren,
    strongFoundationChildren,
    partialFoundationChildren,
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

  const ownHasMeaningfulSignals =
    ownStatus === "COMPLETE" ||
    ownStatus === "PARTIAL" ||
    ownStatus === "OPEN" ||
    ownProbabilityScore >= 0.28 ||
    ownFoundationSignalScore >= 2.0 ||
    ownDirectEntrypointCount > 0 ||
    ownImplementationAnchors >= 2 ||
    (ownCandidateCount >= 1 && ownRepoRefFiles >= 1);

  const ownStrongFoundation =
    ownFoundationSignalScore >= 2.3 ||
    ownDirectEntrypointCount > 0 ||
    ownImplementationAnchors >= 2 ||
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
    ownHasMeaningfulSignals,
    ownStrongFoundation,
    ownDiagnostics: review?.diagnostics || null,
  };
}

function buildAggregateReason({
  status,
  foundationDomain,
  summary,
  ownMetrics,
}) {
  if (status === "COMPLETE") {
    return "reachable_implementation_connected_to_runtime";
  }

  if (status === "PARTIAL") {
    if (
      foundationDomain &&
      (ownMetrics.ownStrongFoundation || summary.strongFoundationChildren > 0)
    ) {
      return "runtime_foundation_partially_proven";
    }

    if (
      ownMetrics.ownHasMeaningfulSignals &&
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

function pushRule(diag, name, passed, details = {}) {
  diag.rules.push({
    name,
    passed: !!passed,
    details,
  });
}

function buildAggregateDiagnostics({
  tags,
  foundationDomain,
  summary,
  ownMetrics,
  childEntries,
}) {
  return {
    evaluator: "aggregate_real_status_v3_guard_non_foundation",
    scopeTags: toArray(tags),
    foundationDomain: !!foundationDomain,
    metrics: {
      totalChildren: summary.totalChildren,
      completeCount: summary.completeCount,
      partialCount: summary.partialCount,
      partialOrBetterCount: summary.partialOrBetterCount,
      openCount: summary.openCount,
      unknownCount: summary.unknownCount,
      activeChildren: summary.activeChildren,
      activeRatio: round3(summary.activeRatio),
      reachabilityChildren: summary.reachabilityChildren,
      strongFoundationChildren: summary.strongFoundationChildren,
      partialFoundationChildren: summary.partialFoundationChildren,

      ownExactStatus: ownMetrics.ownStatus,
      ownProbabilityScore: round3(ownMetrics.ownProbabilityScore),
      ownFoundationSignalScore: round3(ownMetrics.ownFoundationSignalScore),
      ownCoverageScore: round3(ownMetrics.ownCoverageScore),
      ownDirectEntrypointCount: ownMetrics.ownDirectEntrypointCount,
      ownCandidateCount: ownMetrics.ownCandidateCount,
      ownRepoRefFiles: ownMetrics.ownRepoRefFiles,
      ownImplementationAnchors: ownMetrics.ownImplementationAnchors,
      ownHasMeaningfulSignals: ownMetrics.ownHasMeaningfulSignals,
      ownStrongFoundation: ownMetrics.ownStrongFoundation,
    },
    childStatuses: childEntries.slice(0, 20).map((entry) => ({
      code: String(entry?.item?.code || ""),
      status: String(entry?.review?.status || "UNKNOWN"),
      reason: String(entry?.review?.reason || ""),
      chosenRule: entry?.review?.diagnostics?.chosenRule || null,
    })),
    rules: [],
    chosenRule: null,
    ownExactDiagnostics: ownMetrics.ownDiagnostics || null,
  };
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

  if (
    String(baseItem?.kind || "").toLowerCase() === "item" ||
    childEntries.length === 0
  ) {
    const fallback =
      baseOwnReview?.review ||
      createRealReview({
        status: "UNKNOWN",
        reason: "insufficient_real_evidence",
        evidence: [],
        connectedness: {
          aggregateMode: "exact_fallback",
        },
        diagnostics: {
          evaluator: "aggregate_real_status_v3_guard_non_foundation",
          chosenRule: "exact_fallback",
          rules: [],
        },
      });

    return fallback;
  }

  const tags = buildScopeSemanticProfile(scopeWorkflowItems)?.tags || [];
  const foundationDomain = isFoundationDomainTags(tags);
  const summary = summarizeChildReviews(childEntries);
  const ownMetrics = getOwnExactMetrics(baseOwnReview);
  const diagnostics = buildAggregateDiagnostics({
    tags,
    foundationDomain,
    summary,
    ownMetrics,
    childEntries,
  });

  const total = summary.totalChildren;

  const completeByBroadChildren =
    summary.completeCount >= Math.max(2, Math.ceil(total * 0.45)) &&
    summary.partialOrBetterCount >= Math.max(2, Math.ceil(total * 0.35)) &&
    (
      summary.reachabilityChildren >= 1 ||
      ownMetrics.ownDirectEntrypointCount > 0
    );

  pushRule(diagnostics, "complete_by_broad_children", completeByBroadChildren, {
    completeCount: summary.completeCount,
    requiredCompleteCount: Math.max(2, Math.ceil(total * 0.45)),
    partialOrBetterCount: summary.partialOrBetterCount,
    requiredPartialOrBetterCount: Math.max(2, Math.ceil(total * 0.35)),
    reachabilityChildren: summary.reachabilityChildren,
    ownDirectEntrypointCount: ownMetrics.ownDirectEntrypointCount,
  });

  let status = "UNKNOWN";

  if (completeByBroadChildren) {
    status = "COMPLETE";
    diagnostics.chosenRule = "complete_by_broad_children";
  } else {
    const partialByOwnFoundation =
      foundationDomain &&
      ownMetrics.ownHasMeaningfulSignals &&
      ownMetrics.ownStrongFoundation;

    pushRule(diagnostics, "partial_by_own_foundation", partialByOwnFoundation, {
      foundationDomain,
      ownHasMeaningfulSignals: ownMetrics.ownHasMeaningfulSignals,
      ownStrongFoundation: ownMetrics.ownStrongFoundation,
    });

    const partialByChildFoundation =
      foundationDomain &&
      (
        summary.partialOrBetterCount >= 1 ||
        summary.reachabilityChildren >= 1 ||
        summary.strongFoundationChildren >= 1
      ) &&
      summary.activeRatio >= 0.08;

    pushRule(diagnostics, "partial_by_child_foundation", partialByChildFoundation, {
      foundationDomain,
      partialOrBetterCount: summary.partialOrBetterCount,
      reachabilityChildren: summary.reachabilityChildren,
      strongFoundationChildren: summary.strongFoundationChildren,
      activeRatio: round3(summary.activeRatio),
      requiredActiveRatio: 0.08,
    });

    // IMPORTANT GUARD:
    // non-foundation stages must not become PARTIAL only because children
    // carry foundation-like partials. Require either own proof or runtime reachability.
    const partialByGeneralChildren =
      !foundationDomain &&
      summary.partialOrBetterCount >= 2 &&
      summary.activeRatio >= 0.18 &&
      (
        ownMetrics.ownStatus === "PARTIAL" ||
        ownMetrics.ownStatus === "COMPLETE" ||
        ownMetrics.ownHasMeaningfulSignals ||
        summary.reachabilityChildren >= 1
      );

    pushRule(diagnostics, "partial_by_general_children", partialByGeneralChildren, {
      foundationDomain,
      partialOrBetterCount: summary.partialOrBetterCount,
      requiredPartialOrBetterCount: 2,
      activeRatio: round3(summary.activeRatio),
      requiredActiveRatio: 0.18,
      ownStatus: ownMetrics.ownStatus,
      ownHasMeaningfulSignals: ownMetrics.ownHasMeaningfulSignals,
      reachabilityChildren: summary.reachabilityChildren,
    });

    const partialByOwnNonFoundation =
      !foundationDomain &&
      ownMetrics.ownStatus === "PARTIAL" &&
      ownMetrics.ownProbabilityScore >= 0.44 &&
      ownMetrics.ownDirectEntrypointCount > 0;

    pushRule(diagnostics, "partial_by_own_non_foundation", partialByOwnNonFoundation, {
      foundationDomain,
      ownStatus: ownMetrics.ownStatus,
      ownProbabilityScore: round3(ownMetrics.ownProbabilityScore),
      requiredOwnProbabilityScore: 0.44,
      ownDirectEntrypointCount: ownMetrics.ownDirectEntrypointCount,
      requiredOwnDirectEntrypointCount: 1,
    });

    if (
      partialByOwnFoundation ||
      partialByChildFoundation ||
      partialByGeneralChildren ||
      partialByOwnNonFoundation
    ) {
      status = "PARTIAL";
      diagnostics.chosenRule = partialByOwnFoundation
        ? "partial_by_own_foundation"
        : partialByChildFoundation
          ? "partial_by_child_foundation"
          : partialByGeneralChildren
            ? "partial_by_general_children"
            : "partial_by_own_non_foundation";
    } else if (
      summary.openCount > 0 ||
      ownMetrics.ownStatus === "OPEN" ||
      ownMetrics.ownHasMeaningfulSignals
    ) {
      status = "OPEN";
      diagnostics.chosenRule = "fallback_open_by_some_real_signals";
    } else {
      status = "UNKNOWN";
      diagnostics.chosenRule = "fallback_unknown_no_meaningful_signals";
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
      aggregateMode: "own_plus_child_real_aggregation_v3_guard_non_foundation",
      foundationDomain,
      totalChildren: summary.totalChildren,
      completeCount: summary.completeCount,
      partialCount: summary.partialCount,
      partialOrBetterCount: summary.partialOrBetterCount,
      openCount: summary.openCount,
      unknownCount: summary.unknownCount,
      activeChildren: summary.activeChildren,
      activeRatio: round3(summary.activeRatio),
      reachabilityChildren: summary.reachabilityChildren,
      strongFoundationChildren: summary.strongFoundationChildren,
      partialFoundationChildren: summary.partialFoundationChildren,

      ownExactStatus: ownMetrics.ownStatus,
      ownProbabilityScore: round3(ownMetrics.ownProbabilityScore),
      ownFoundationSignalScore: round3(ownMetrics.ownFoundationSignalScore),
      ownCoverageScore: round3(ownMetrics.ownCoverageScore),
      ownDirectEntrypointCount: ownMetrics.ownDirectEntrypointCount,
      ownCandidateCount: ownMetrics.ownCandidateCount,
      ownRepoRefFiles: ownMetrics.ownRepoRefFiles,
      ownImplementationAnchors: ownMetrics.ownImplementationAnchors,
      ownHasMeaningfulSignals: ownMetrics.ownHasMeaningfulSignals,
      ownStrongFoundation: ownMetrics.ownStrongFoundation,
    },
    diagnostics,
  });
}

export default {
  buildAggregatedRealReview,
};
