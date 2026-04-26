// src/core/memory/MemoryPeriodicReviewPolicy.js
// STAGE 7.8.4 — BOUNDED PERIODIC DIALOGUE REVIEW POLICY (SKELETON)
//
// Goal:
// - define safe boundaries for future periodic dialogue review
// - prevent uncontrolled raw dialogue review
// - prevent automatic confirmed-memory writes from raw dialogue
// - prepare a bounded policy for later archive/digest runtime
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO cron/worker here.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO automatic confirmed memory writes.
// - This module is deterministic policy/diagnostic only.

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

function _normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export const MEMORY_PERIODIC_REVIEW_POLICY_VERSION =
  "memory-periodic-review-policy-7.8.4-001";

export const MEMORY_PERIODIC_REVIEW_DEFAULTS = Object.freeze({
  enabledByDefault: false,
  requiresExplicitRuntimeEnable: true,
  requiresMonarchApprovalForConfirmedWrites: true,
  maxMessagesPerReview: 50,
  maxCharsPerMessage: 2000,
  maxTotalCharsPerReview: 20000,
  minReviewIntervalMinutes: 240,
  maxTopicsPerReview: 10,
  allowRawPromptInjection: false,
  allowAutomaticConfirmedMemoryWrites: false,
  allowAutomaticDigestWrites: false,
  failClosedOnAmbiguousIntent: true,
});

export function getMemoryPeriodicReviewPolicy() {
  return {
    ok: true,
    version: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
    defaults: MEMORY_PERIODIC_REVIEW_DEFAULTS,
    allowedFutureOutputs: [
      "review_candidates",
      "digest_candidates",
      "confirmed_memory_candidates",
      "risk_flags",
    ],
    forbiddenOutputs: [
      "automatic_confirmed_memory_write",
      "unbounded_raw_dialogue_prompt",
      "cross_user_context_mix",
      "cross_group_raw_recall",
      "silent_profile_change",
    ],
    invariants: [
      "periodic review is disabled by default",
      "raw dialogue review must be bounded by count and size",
      "raw dialogue must not become prompt memory automatically",
      "confirmed memory writes require explicit approved path",
      "digest generation rules require separate approved stage",
      "ambiguous write intent must fail closed",
    ],
  };
}

export function buildPeriodicReviewRequest({
  globalUserId = null,
  chatId = null,
  reason = null,
  requestedBy = null,
  maxMessages = null,
  maxCharsPerMessage = null,
  maxTotalChars = null,
  topicHint = null,
  metadata = {},
} = {}) {
  const chatIdStr = chatId ? String(chatId) : null;
  const reasonStr = _safeStr(reason).trim();
  const requestedByStr = _safeStr(requestedBy).trim();
  const topicHintStr = _safeStr(topicHint).trim() || null;
  const safeMeta = _safeObj(metadata);

  if (!chatIdStr) {
    return {
      ok: false,
      reason: "missing_chatId",
      version: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
    };
  }

  if (!reasonStr) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      reason: "missing_review_reason",
      version: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
    };
  }

  const safeMaxMessages = _normalizeLimit(
    maxMessages,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxMessagesPerReview,
    1,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxMessagesPerReview
  );
  const safeMaxCharsPerMessage = _normalizeLimit(
    maxCharsPerMessage,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxCharsPerMessage,
    100,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxCharsPerMessage
  );
  const safeMaxTotalChars = _normalizeLimit(
    maxTotalChars,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxTotalCharsPerReview,
    1000,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxTotalCharsPerReview
  );

  return {
    ok: true,
    enabled: false,
    chatId: chatIdStr,
    globalUserId: globalUserId || null,
    reason: reasonStr,
    requestedBy: requestedByStr || "unknown",
    topicHint: topicHintStr,
    limits: {
      maxMessages: safeMaxMessages,
      maxCharsPerMessage: safeMaxCharsPerMessage,
      maxTotalChars: safeMaxTotalChars,
      maxTopics: MEMORY_PERIODIC_REVIEW_DEFAULTS.maxTopicsPerReview,
      minReviewIntervalMinutes:
        MEMORY_PERIODIC_REVIEW_DEFAULTS.minReviewIntervalMinutes,
    },
    safety: {
      rawPromptInjectionAllowed: false,
      automaticConfirmedMemoryWritesAllowed: false,
      automaticDigestWritesAllowed: false,
      failClosedOnAmbiguousIntent: true,
    },
    metadata: {
      ...safeMeta,
      policyVersion: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
      policyLayer: "bounded_periodic_dialogue_review",
    },
    version: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
    note: "policy_request_only_no_runtime_review",
  };
}

export function assertPeriodicReviewAllowed(request = {}) {
  const req = _safeObj(request);
  const errors = [];

  const chatIdStr = req.chatId ? String(req.chatId) : null;
  const reasonStr = _safeStr(req.reason).trim();
  const limits = _safeObj(req.limits);
  const safety = _safeObj(req.safety);

  if (!chatIdStr) errors.push("missing_chatId");
  if (!reasonStr) errors.push("missing_review_reason");

  const maxMessages = _normalizeLimit(
    limits.maxMessages,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxMessagesPerReview,
    1,
    1000000
  );
  const maxCharsPerMessage = _normalizeLimit(
    limits.maxCharsPerMessage,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxCharsPerMessage,
    1,
    1000000
  );
  const maxTotalChars = _normalizeLimit(
    limits.maxTotalChars,
    MEMORY_PERIODIC_REVIEW_DEFAULTS.maxTotalCharsPerReview,
    1,
    10000000
  );

  if (maxMessages > MEMORY_PERIODIC_REVIEW_DEFAULTS.maxMessagesPerReview) {
    errors.push("max_messages_exceeds_policy");
  }

  if (
    maxCharsPerMessage > MEMORY_PERIODIC_REVIEW_DEFAULTS.maxCharsPerMessage
  ) {
    errors.push("max_chars_per_message_exceeds_policy");
  }

  if (maxTotalChars > MEMORY_PERIODIC_REVIEW_DEFAULTS.maxTotalCharsPerReview) {
    errors.push("max_total_chars_exceeds_policy");
  }

  if (safety.rawPromptInjectionAllowed === true) {
    errors.push("raw_prompt_injection_allowed");
  }

  if (safety.automaticConfirmedMemoryWritesAllowed === true) {
    errors.push("automatic_confirmed_memory_writes_allowed");
  }

  if (safety.automaticDigestWritesAllowed === true) {
    errors.push("automatic_digest_writes_allowed");
  }

  return {
    ok: errors.length === 0,
    errors,
    version: MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
  };
}

export default {
  MEMORY_PERIODIC_REVIEW_POLICY_VERSION,
  MEMORY_PERIODIC_REVIEW_DEFAULTS,
  getMemoryPeriodicReviewPolicy,
  buildPeriodicReviewRequest,
  assertPeriodicReviewAllowed,
};
