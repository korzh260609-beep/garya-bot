// src/core/memory/MemoryDigestGenerationPolicy.js
// STAGE 7.8.6 — DIGEST GENERATION RULES (SKELETON)
//
// Goal:
// - define safe rules for future topic digest generation
// - keep digest generation separate from confirmed memory writes
// - prevent raw dialogue from becoming uncontrolled prompt memory
// - prepare bounded digest candidate requests for later runtime stages
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO AI calls here.
// - NO digest generation here.
// - NO automatic digest writes here.
// - NO automatic confirmed memory writes here.
// - NO automatic prompt injection.
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

export const MEMORY_DIGEST_GENERATION_POLICY_VERSION =
  "memory-digest-generation-policy-7.8.6-001";

export const MEMORY_DIGEST_GENERATION_DEFAULTS = Object.freeze({
  enabledByDefault: false,
  aiGenerationActive: false,
  automaticDigestWritesAllowed: false,
  automaticConfirmedMemoryWritesAllowed: false,
  rawPromptInjectionAllowed: false,
  maxSourceItems: 50,
  maxSourceChars: 20000,
  maxDigestChars: 3000,
  maxCandidateFacts: 10,
  maxTopicKeyLength: 80,
  failClosedOnAmbiguousSource: true,
});

export function getMemoryDigestGenerationPolicy() {
  return {
    ok: true,
    version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
    defaults: MEMORY_DIGEST_GENERATION_DEFAULTS,
    allowedFutureInputs: [
      "bounded_archive_items",
      "explicit_topic_key",
      "trusted_periodic_review_request",
      "trusted_manual_review_request",
    ],
    allowedFutureOutputs: [
      "digest_candidate",
      "candidate_source_refs",
      "candidate_fact_suggestions",
      "review_notes",
    ],
    forbiddenOutputs: [
      "automatic_confirmed_memory_write",
      "automatic_digest_write_without_approved_path",
      "unbounded_raw_dialogue_prompt",
      "cross_user_digest",
      "cross_group_digest",
      "silent_profile_change",
    ],
    invariants: [
      "digest generation is disabled by default",
      "digest is not confirmed memory",
      "digest candidates must include sourceRefs",
      "confirmed memory candidates require separate approval/write path",
      "raw dialogue must be bounded before any future digest generation",
      "ambiguous source must fail closed",
    ],
  };
}

export function buildDigestGenerationRequest({
  globalUserId = null,
  chatId = null,
  topicKey = null,
  sourceRefs = [],
  sourceItemsCount = null,
  sourceChars = null,
  requestedBy = null,
  metadata = {},
} = {}) {
  const chatIdStr = chatId ? String(chatId) : null;
  const topicKeyStr = _safeStr(topicKey).trim().slice(0, MEMORY_DIGEST_GENERATION_DEFAULTS.maxTopicKeyLength);
  const requestedByStr = _safeStr(requestedBy).trim() || "unknown";
  const safeMeta = _safeObj(metadata);
  const safeSourceRefs = Array.isArray(sourceRefs)
    ? sourceRefs.map((x) => _safeStr(x).trim()).filter(Boolean)
    : [];

  if (!chatIdStr) {
    return {
      ok: false,
      reason: "missing_chatId",
      version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
    };
  }

  if (!topicKeyStr) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      reason: "missing_topicKey",
      version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
    };
  }

  const safeSourceItemsCount = _normalizeLimit(
    sourceItemsCount,
    0,
    0,
    MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceItems
  );
  const safeSourceChars = _normalizeLimit(
    sourceChars,
    0,
    0,
    MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceChars
  );

  if (safeSourceRefs.length === 0 && safeSourceItemsCount === 0) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      topicKey: topicKeyStr,
      reason: "missing_source_refs_or_items",
      version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
    };
  }

  return {
    ok: true,
    enabled: false,
    chatId: chatIdStr,
    globalUserId: globalUserId || null,
    topicKey: topicKeyStr,
    requestedBy: requestedByStr,
    sourceRefs: safeSourceRefs,
    limits: {
      maxSourceItems: MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceItems,
      maxSourceChars: MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceChars,
      maxDigestChars: MEMORY_DIGEST_GENERATION_DEFAULTS.maxDigestChars,
      maxCandidateFacts: MEMORY_DIGEST_GENERATION_DEFAULTS.maxCandidateFacts,
    },
    sourceStats: {
      sourceItemsCount: safeSourceItemsCount,
      sourceChars: safeSourceChars,
    },
    safety: {
      aiGenerationActive: false,
      automaticDigestWritesAllowed: false,
      automaticConfirmedMemoryWritesAllowed: false,
      rawPromptInjectionAllowed: false,
      failClosedOnAmbiguousSource: true,
    },
    metadata: {
      ...safeMeta,
      policyVersion: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
      policyLayer: "digest_generation_rules",
    },
    version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
    note: "policy_request_only_no_runtime_generation",
  };
}

export function assertDigestGenerationAllowed(request = {}) {
  const req = _safeObj(request);
  const errors = [];

  const chatIdStr = req.chatId ? String(req.chatId) : null;
  const topicKeyStr = _safeStr(req.topicKey).trim();
  const limits = _safeObj(req.limits);
  const sourceStats = _safeObj(req.sourceStats);
  const safety = _safeObj(req.safety);

  if (!chatIdStr) errors.push("missing_chatId");
  if (!topicKeyStr) errors.push("missing_topicKey");

  const sourceItemsCount = _normalizeLimit(
    sourceStats.sourceItemsCount,
    0,
    0,
    1000000
  );
  const sourceChars = _normalizeLimit(sourceStats.sourceChars, 0, 0, 100000000);

  const maxSourceItems = _normalizeLimit(
    limits.maxSourceItems,
    MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceItems,
    1,
    1000000
  );
  const maxSourceChars = _normalizeLimit(
    limits.maxSourceChars,
    MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceChars,
    1,
    100000000
  );
  const maxDigestChars = _normalizeLimit(
    limits.maxDigestChars,
    MEMORY_DIGEST_GENERATION_DEFAULTS.maxDigestChars,
    1,
    1000000
  );

  if (maxSourceItems > MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceItems) {
    errors.push("max_source_items_exceeds_policy");
  }

  if (maxSourceChars > MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceChars) {
    errors.push("max_source_chars_exceeds_policy");
  }

  if (maxDigestChars > MEMORY_DIGEST_GENERATION_DEFAULTS.maxDigestChars) {
    errors.push("max_digest_chars_exceeds_policy");
  }

  if (sourceItemsCount > MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceItems) {
    errors.push("source_items_count_exceeds_policy");
  }

  if (sourceChars > MEMORY_DIGEST_GENERATION_DEFAULTS.maxSourceChars) {
    errors.push("source_chars_exceeds_policy");
  }

  if (safety.aiGenerationActive === true) {
    errors.push("ai_generation_active_without_stage_approval");
  }

  if (safety.automaticDigestWritesAllowed === true) {
    errors.push("automatic_digest_writes_allowed");
  }

  if (safety.automaticConfirmedMemoryWritesAllowed === true) {
    errors.push("automatic_confirmed_memory_writes_allowed");
  }

  if (safety.rawPromptInjectionAllowed === true) {
    errors.push("raw_prompt_injection_allowed");
  }

  return {
    ok: errors.length === 0,
    errors,
    version: MEMORY_DIGEST_GENERATION_POLICY_VERSION,
  };
}

export default {
  MEMORY_DIGEST_GENERATION_POLICY_VERSION,
  MEMORY_DIGEST_GENERATION_DEFAULTS,
  getMemoryDigestGenerationPolicy,
  buildDigestGenerationRequest,
  assertDigestGenerationAllowed,
};
