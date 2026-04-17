// ============================================================================
// === src/core/stageCheck/real/realItemReviewService.js
// === builds exact real-review per workflow item
// ============================================================================

import { collectRealEvidence } from "./realEvidenceCollector.js";
import { evaluateRealStatus } from "./realStatusEvaluator.js";

function normalizeItemMeta(item) {
  return {
    code: item?.code || "",
    title: item?.title || "",
    kind: item?.kind || "",
    parentCode: item?.parentCode || null,
  };
}

export async function buildExactItemRealReview({
  item,
  evaluationCtx,
} = {}) {
  if (!item) return null;

  const exactScopeItems = [item];

  const realEvidence = await collectRealEvidence({
    scopeWorkflowItems: exactScopeItems,
    evaluationCtx,
  });

  const review = evaluateRealStatus({
    realEvidence,
  });

  return {
    item: normalizeItemMeta(item),
    review,
  };
}

export async function buildSubtreeItemRealReviews({
  scopeWorkflowItems,
  evaluationCtx,
} = {}) {
  const list = Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
  const results = [];

  for (const item of list) {
    const exact = await buildExactItemRealReview({
      item,
      evaluationCtx,
    });

    if (exact) {
      results.push(exact);
    }
  }

  return results;
}

export default {
  buildExactItemRealReview,
  buildSubtreeItemRealReviews,
};
