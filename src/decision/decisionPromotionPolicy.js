// src/decision/decisionPromotionPolicy.js
// Policy-only skeleton.
// IMPORTANT:
// - no production effect
// - no routing changes
// - no auto-promotion

import { DECISION_KIND } from "./decisionTypes.js";

const PROMOTION_CANDIDATES = new Set([
  DECISION_KIND.SOURCE_QUERY,
  DECISION_KIND.SYSTEM_DIAG,
  DECISION_KIND.TASK_EXECUTION,
  DECISION_KIND.CHAT_SIMPLE,
]);

const PROMOTION_BLOCKLIST = new Set([
  DECISION_KIND.CHAT_COMPLEX,
  DECISION_KIND.REPO_ANALYSIS,
  DECISION_KIND.UNKNOWN,
]);

export function getDecisionPromotionCandidates() {
  return [...PROMOTION_CANDIDATES];
}

export function getDecisionPromotionBlocklist() {
  return [...PROMOTION_BLOCKLIST];
}

export function canPromoteDecisionKind(kind) {
  return PROMOTION_CANDIDATES.has(kind);
}

export function isDecisionPromotionBlocked(kind) {
  return PROMOTION_BLOCKLIST.has(kind);
}