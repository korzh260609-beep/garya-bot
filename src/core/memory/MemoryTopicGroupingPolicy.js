// src/core/memory/MemoryTopicGroupingPolicy.js
// STAGE 7.8.5 — TOPIC GROUPING / CLUSTERING RULES (SKELETON)
//
// Goal:
// - define deterministic rules for future topic grouping
// - prepare safe topic keys for archive/digest restore
// - prevent uncontrolled cross-topic and cross-user mixing
// - keep clustering policy separated from AI generation and storage
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO AI clustering here.
// - NO vector search here.
// - NO automatic prompt injection.
// - NO writes here.
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

export const MEMORY_TOPIC_GROUPING_POLICY_VERSION =
  "memory-topic-grouping-policy-7.8.5-001";

export const MEMORY_TOPIC_GROUPING_DEFAULTS = Object.freeze({
  maxTopicKeyLength: 80,
  maxTopicLabelLength: 120,
  maxTopicsPerReview: 10,
  maxItemsPerTopic: 50,
  allowCrossUserGrouping: false,
  allowCrossGroupGrouping: false,
  allowRawPromptInjection: false,
  aiClusteringActive: false,
  vectorSearchActive: false,
  failClosedOnAmbiguousTopic: true,
});

export function normalizeTopicKey(value = null) {
  const raw = _safeStr(value).trim().toLowerCase();
  if (!raw) return null;

  const normalized = raw
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9а-яёіїєґ-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, MEMORY_TOPIC_GROUPING_DEFAULTS.maxTopicKeyLength);

  return normalized || null;
}

export function getMemoryTopicGroupingPolicy() {
  return {
    ok: true,
    version: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
    defaults: MEMORY_TOPIC_GROUPING_DEFAULTS,
    allowedFutureInputs: [
      "explicit_topic_key",
      "trusted_command_topic_hint",
      "bounded_archive_batch",
      "bounded_digest_candidate",
    ],
    forbiddenInputs: [
      "unbounded_raw_dialogue",
      "cross_user_raw_context",
      "cross_group_raw_context",
      "silent_ai_topic_inference_as_fact",
    ],
    invariants: [
      "topic grouping must be bounded by topic count and item count",
      "topicKey must be normalized before use",
      "ambiguous topic intent must fail closed",
      "topic grouping must not confirm facts by itself",
      "topic grouping must not inject raw dialogue into prompts",
      "cross-user and cross-group grouping are forbidden until later approved stages",
    ],
  };
}

export function buildTopicGroupRequest({
  globalUserId = null,
  chatId = null,
  topicKey = null,
  topicLabel = null,
  source = null,
  maxItems = null,
  metadata = {},
} = {}) {
  const chatIdStr = chatId ? String(chatId) : null;
  const normalizedTopicKey = normalizeTopicKey(topicKey || topicLabel);
  const labelStr = _safeStr(topicLabel || topicKey)
    .trim()
    .slice(0, MEMORY_TOPIC_GROUPING_DEFAULTS.maxTopicLabelLength);
  const sourceStr = _safeStr(source).trim() || "unknown";
  const safeMeta = _safeObj(metadata);

  if (!chatIdStr) {
    return {
      ok: false,
      reason: "missing_chatId",
      version: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
    };
  }

  if (!normalizedTopicKey) {
    return {
      ok: false,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      reason: "missing_or_invalid_topic_key",
      version: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
    };
  }

  const safeMaxItems = _normalizeLimit(
    maxItems,
    MEMORY_TOPIC_GROUPING_DEFAULTS.maxItemsPerTopic,
    1,
    MEMORY_TOPIC_GROUPING_DEFAULTS.maxItemsPerTopic
  );

  return {
    ok: true,
    enabled: false,
    chatId: chatIdStr,
    globalUserId: globalUserId || null,
    topicKey: normalizedTopicKey,
    topicLabel: labelStr || normalizedTopicKey,
    source: sourceStr,
    limits: {
      maxItems: safeMaxItems,
      maxTopicsPerReview: MEMORY_TOPIC_GROUPING_DEFAULTS.maxTopicsPerReview,
      maxTopicKeyLength: MEMORY_TOPIC_GROUPING_DEFAULTS.maxTopicKeyLength,
      maxTopicLabelLength: MEMORY_TOPIC_GROUPING_DEFAULTS.maxTopicLabelLength,
    },
    safety: {
      crossUserGroupingAllowed: false,
      crossGroupGroupingAllowed: false,
      rawPromptInjectionAllowed: false,
      aiClusteringActive: false,
      vectorSearchActive: false,
      failClosedOnAmbiguousTopic: true,
    },
    metadata: {
      ...safeMeta,
      policyVersion: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
      policyLayer: "topic_grouping_rules",
    },
    version: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
    note: "policy_request_only_no_runtime_grouping",
  };
}

export function assertTopicGroupingAllowed(request = {}) {
  const req = _safeObj(request);
  const errors = [];

  const chatIdStr = req.chatId ? String(req.chatId) : null;
  const topicKey = normalizeTopicKey(req.topicKey);
  const limits = _safeObj(req.limits);
  const safety = _safeObj(req.safety);

  if (!chatIdStr) errors.push("missing_chatId");
  if (!topicKey) errors.push("missing_or_invalid_topic_key");

  const maxItems = _normalizeLimit(
    limits.maxItems,
    MEMORY_TOPIC_GROUPING_DEFAULTS.maxItemsPerTopic,
    1,
    1000000
  );

  if (maxItems > MEMORY_TOPIC_GROUPING_DEFAULTS.maxItemsPerTopic) {
    errors.push("max_items_exceeds_policy");
  }

  if (safety.crossUserGroupingAllowed === true) {
    errors.push("cross_user_grouping_allowed");
  }

  if (safety.crossGroupGroupingAllowed === true) {
    errors.push("cross_group_grouping_allowed");
  }

  if (safety.rawPromptInjectionAllowed === true) {
    errors.push("raw_prompt_injection_allowed");
  }

  if (safety.aiClusteringActive === true) {
    errors.push("ai_clustering_active_without_stage_approval");
  }

  if (safety.vectorSearchActive === true) {
    errors.push("vector_search_active_without_stage_approval");
  }

  return {
    ok: errors.length === 0,
    errors,
    topicKey,
    version: MEMORY_TOPIC_GROUPING_POLICY_VERSION,
  };
}

export default {
  MEMORY_TOPIC_GROUPING_POLICY_VERSION,
  MEMORY_TOPIC_GROUPING_DEFAULTS,
  normalizeTopicKey,
  getMemoryTopicGroupingPolicy,
  buildTopicGroupRequest,
  assertTopicGroupingAllowed,
};
