// ============================================================================
// === src/core/stageCheck/contracts/stageCheckTypes.js
// === canonical stage-check status contracts
// ============================================================================

export const FORMAL_STATUSES = Object.freeze([
  "COMPLETE",
  "PARTIAL",
  "OPEN",
  "NO_SIGNALS",
]);

export const REAL_STATUSES = Object.freeze([
  "COMPLETE",
  "PARTIAL",
  "OPEN",
  "UNKNOWN",
]);

export const GAP_REASONS = Object.freeze([
  "aligned",
  "under_detected_by_checker",
  "overestimated_by_checker",
  "insufficient_real_evidence",
]);

export function normalizeFormalStatus(value) {
  const raw = String(value || "").toUpperCase().trim();
  return FORMAL_STATUSES.includes(raw) ? raw : "NO_SIGNALS";
}

export function normalizeRealStatus(value) {
  const raw = String(value || "").toUpperCase().trim();
  return REAL_STATUSES.includes(raw) ? raw : "UNKNOWN";
}

export function normalizeGapReason(value) {
  const raw = String(value || "").trim();
  return GAP_REASONS.includes(raw) ? raw : "insufficient_real_evidence";
}

export function createFormalReview({
  status = "NO_SIGNALS",
  reason = "",
  evidence = [],
  aggregate = null,
} = {}) {
  return {
    status: normalizeFormalStatus(status),
    reason: String(reason || ""),
    evidence: Array.isArray(evidence) ? evidence : [],
    aggregate,
  };
}

export function createRealReview({
  status = "UNKNOWN",
  reason = "",
  evidence = [],
  connectedness = null,
  diagnostics = null,
} = {}) {
  return {
    status: normalizeRealStatus(status),
    reason: String(reason || ""),
    evidence: Array.isArray(evidence) ? evidence : [],
    connectedness,
    diagnostics:
      diagnostics && typeof diagnostics === "object" ? diagnostics : null,
  };
}

export function createGapReview({
  exists = false,
  reason = "insufficient_real_evidence",
} = {}) {
  return {
    exists: !!exists,
    reason: normalizeGapReason(reason),
  };
}
