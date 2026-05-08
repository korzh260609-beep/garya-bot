// src/memory/policies/confirmedMemoryPolicy.js
// SG 2.0 — Confirmed Memory Policy Skeleton
//
// Purpose:
// - Protect confirmed user memory from raw chat, duplicates, conflicts, and transport-specific fragmentation.
// - Deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const CONFIRMED_MEMORY_POLICY_VERSION = 1;

export function getConfirmedMemoryPolicy() {
  return {
    version: CONFIRMED_MEMORY_POLICY_VERSION,
    rawChatIsNotConfirmedMemory: true,
    automaticPromotionFromRawChat: false,
    globalUserIdRequiredForUserMemory: true,
    unifiedAcrossTransportsByGlobalUserId: true,
    transportIdIsNotMemoryOwner: true,
    missingIdentityBehavior: "session_only_or_fail_closed",
    forbidden: [
      "confirm_memory_from_raw_chat_without_policy",
      "store_user_memory_without_global_user_id",
      "store_long_term_memory_by_telegram_chat_id_only",
      "split_same_user_memory_by_transport",
      "auto_merge_users_without_verified_linking",
      "silent_overwrite_conflicting_memory",
      "store_secret_or_private_token",
    ],
  };
}

export function assertConfirmedMemoryAllowed({
  globalUserId = null,
  explicit = false,
  sourceReviewed = false,
  containsSecret = false,
  duplicate = false,
  conflict = false,
  transportOnlyIdentity = false,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!globalUserId) errors.push("missing_global_user_id");
  if (!explicit) errors.push("memory_not_explicit_or_policy_confirmed");
  if (!sourceReviewed) warnings.push("source_not_reviewed");
  if (containsSecret) errors.push("contains_secret");
  if (conflict) errors.push("conflicting_confirmed_memory_requires_review");
  if (transportOnlyIdentity) errors.push("transport_only_identity_not_allowed");

  if (duplicate) {
    return {
      ok: true,
      decision: "NOOP_DUPLICATE",
      errors: [],
      warnings,
      policy: getConfirmedMemoryPolicy(),
    };
  }

  return {
    ok: errors.length === 0,
    decision: errors.length === 0 ? "ALLOW_CONFIRMED_MEMORY_CANDIDATE" : "BLOCK_CONFIRMED_MEMORY",
    errors,
    warnings,
    policy: getConfirmedMemoryPolicy(),
  };
}

export default {
  CONFIRMED_MEMORY_POLICY_VERSION,
  getConfirmedMemoryPolicy,
  assertConfirmedMemoryAllowed,
};
