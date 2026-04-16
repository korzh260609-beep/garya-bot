// ============================================================================
// === src/core/stageCheck/formal/formalReviewService.js
// === wrapper around current formal checker engine
// ============================================================================

import {
  buildEvaluatedItems,
  aggregateScope,
} from "../../../bot/handlers/stage-check/evaluator.js";
import { createFormalReview } from "../contracts/stageCheckTypes.js";

function buildFormalReason(aggregate) {
  if (!aggregate) return "formal_aggregate_missing";

  if (aggregate.status === "COMPLETE") {
    return "all_configured_leaf_items_formally_confirmed";
  }

  if (aggregate.status === "PARTIAL") {
    return "some_leaf_items_formally_confirmed";
  }

  if (aggregate.status === "OPEN") {
    return "formal_checks_exist_but_not_confirmed";
  }

  return "no_formal_signals";
}

function buildFormalEvidence(aggregate) {
  if (!aggregate) return [];

  const evidence = [];
  const passed = Array.isArray(aggregate.passedEntries) ? aggregate.passedEntries : [];
  const failed = Array.isArray(aggregate.failedEntries) ? aggregate.failedEntries : [];

  for (const entry of passed.slice(0, 12)) {
    evidence.push({
      side: "formal",
      ok: true,
      code: entry.code,
      title: entry.title,
      semanticType: entry.semanticType || "generic",
      type: entry.type || "unknown",
      label: String(entry?.check?.label || ""),
      details: String(entry?.details || ""),
      evidenceClass: String(entry?.check?.evidenceClass || ""),
    });
  }

  if (evidence.length === 0 && failed.length > 0) {
    for (const entry of failed.slice(0, 6)) {
      evidence.push({
        side: "formal",
        ok: false,
        code: entry.code,
        title: entry.title,
        semanticType: entry.semanticType || "generic",
        type: entry.type || "unknown",
        label: String(entry?.check?.label || ""),
        details: String(entry?.details || ""),
        evidenceClass: String(entry?.check?.evidenceClass || ""),
      });
    }
  }

  return evidence;
}

export async function runFormalReview({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const scopeItems = await buildEvaluatedItems(scopeWorkflowItems, evaluationCtx);
  const aggregate = aggregateScope(scopeItems);

  return {
    scopeItems,
    aggregate,
    review: createFormalReview({
      status: aggregate.status,
      reason: buildFormalReason(aggregate),
      evidence: buildFormalEvidence(aggregate),
      aggregate,
    }),
  };
}

export default {
  runFormalReview,
};