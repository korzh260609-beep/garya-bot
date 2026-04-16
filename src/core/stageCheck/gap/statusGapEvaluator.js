// ============================================================================
// === src/core/stageCheck/gap/statusGapEvaluator.js
// === compares formal_status and real_status
// ============================================================================

import { createGapReview } from "../contracts/stageCheckTypes.js";

function rankFormal(status) {
  if (status === "COMPLETE") return 3;
  if (status === "PARTIAL") return 2;
  if (status === "OPEN") return 1;
  if (status === "NO_SIGNALS") return 0;
  return 0;
}

function rankReal(status) {
  if (status === "COMPLETE") return 3;
  if (status === "PARTIAL") return 2;
  if (status === "OPEN") return 1;
  if (status === "UNKNOWN") return -1;
  return -1;
}

export function evaluateStatusGap({
  formalReview,
  realReview,
} = {}) {
  const formalStatus = String(formalReview?.status || "NO_SIGNALS");
  const realStatus = String(realReview?.status || "UNKNOWN");

  if (realStatus === "UNKNOWN") {
    return createGapReview({
      exists: formalStatus !== "NO_SIGNALS",
      reason: "insufficient_real_evidence",
    });
  }

  const formalRank = rankFormal(formalStatus);
  const realRank = rankReal(realStatus);

  if (formalRank === realRank) {
    return createGapReview({
      exists: false,
      reason: "aligned",
    });
  }

  if (realRank > formalRank) {
    return createGapReview({
      exists: true,
      reason: "under_detected_by_checker",
    });
  }

  return createGapReview({
    exists: true,
    reason: "overestimated_by_checker",
  });
}

export default {
  evaluateStatusGap,
};