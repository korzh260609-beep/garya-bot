// src/core/memory/MemoryTopicRecallService.js
// STAGE 7.8.7 — TOPIC-BASED RECALL / CONVERSATION RESTORATION INTERFACE (SKELETON)
//
// Goal:
// - define a safe interface for future topic-based conversation restoration
// - combine policy-level restore requests for archive/digest/confirmed memory
// - prevent uncontrolled raw dialogue from entering prompts
// - keep recall separated from AI answering and storage
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO DB reads here in this skeleton.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO raw archive injection.
// - NO cross-user or cross-group recall.
// - This module is deterministic service/diagnostic only.

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

export const MEMORY_TOPIC_RECALL_SERVICE_VERSION =
  "memory-topic-recall-service-7.8.7-001";

export const MEMORY_TOPIC_RECALL_DEFAULTS = Object.freeze({
  enabledByDefault: false,
  promptFacingByDefault: false,
  rawArchivePromptAllowed: false,
  maxArchiveItems: 20,
  maxDigestItems: 5,
  maxConfirmedItems: 10,
  maxTotalItems: 30,
  maxTotalChars: 12000,
  allowCrossUserRecall: false,
  allowCrossGroupRecall: false,
  failClosedOnAmbiguousTopic: true,
});

export class MemoryTopicRecallService {
  constructor({
    logger = console,
    getEnabled = () => false,
    normalizeTopicKey = (value) => _safeStr(value).trim() || null,
    assertTopicGroupingAllowed = () => ({ ok: false, errors: ["topic_policy_unavailable"] }),
    contractVersion = 1,
  } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.normalizeTopicKey =
      typeof normalizeTopicKey === "function"
        ? normalizeTopicKey
        : (value) => _safeStr(value).trim() || null;
    this.assertTopicGroupingAllowed =
      typeof assertTopicGroupingAllowed === "function"
        ? assertTopicGroupingAllowed
        : () => ({ ok: false, errors: ["topic_policy_unavailable"] });
    this.contractVersion = contractVersion;
  }

  _baseResult(extra = {}) {
    return {
      ok: true,
      enabled: !!this.getEnabled(),
      service: "MemoryTopicRecallService",
      version: MEMORY_TOPIC_RECALL_SERVICE_VERSION,
      contractVersion: this.contractVersion,
      promptFacing: MEMORY_TOPIC_RECALL_DEFAULTS.promptFacingByDefault,
      rawArchivePromptAllowed: false,
      crossUserRecallAllowed: false,
      crossGroupRecallAllowed: false,
      ...extra,
    };
  }

  getPolicy() {
    return this._baseResult({
      defaults: MEMORY_TOPIC_RECALL_DEFAULTS,
      allowedFutureSources: [
        "confirmed_memory_safe_selectors",
        "topic_digest_safe_selectors",
        "bounded_archive_restore_selectors",
      ],
      forbiddenSources: [
        "unbounded_raw_archive",
        "cross_user_raw_dialogue",
        "cross_group_raw_dialogue",
        "silent_profile_memory",
      ],
      invariants: [
        "topic recall is disabled by default",
        "raw archive is not prompt-facing by default",
        "restoration must be bounded by item count and total chars",
        "confirmed facts, digest summaries, and raw archive snippets must stay labeled",
        "ambiguous topic recall must fail closed",
        "cross-user and cross-group recall are forbidden until later approved stages",
      ],
    });
  }

  buildTopicRecallRequest({
    globalUserId = null,
    chatId = null,
    topicKey = null,
    topicLabel = null,
    includeArchive = false,
    includeDigest = true,
    includeConfirmed = true,
    maxArchiveItems = null,
    maxDigestItems = null,
    maxConfirmedItems = null,
    maxTotalItems = null,
    maxTotalChars = null,
    requestedBy = null,
    metadata = {},
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const normalizedTopicKey = this.normalizeTopicKey(topicKey || topicLabel);
    const requestedByStr = _safeStr(requestedBy).trim() || "unknown";
    const safeMeta = _safeObj(metadata);

    if (!chatIdStr) {
      return this._baseResult({
        ok: false,
        reason: "missing_chatId",
      });
    }

    if (!normalizedTopicKey) {
      return this._baseResult({
        ok: false,
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        reason: "missing_or_invalid_topic_key",
      });
    }

    const safeMaxArchiveItems = _normalizeLimit(
      maxArchiveItems,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxArchiveItems,
      0,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxArchiveItems
    );
    const safeMaxDigestItems = _normalizeLimit(
      maxDigestItems,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxDigestItems,
      0,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxDigestItems
    );
    const safeMaxConfirmedItems = _normalizeLimit(
      maxConfirmedItems,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxConfirmedItems,
      0,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxConfirmedItems
    );
    const safeMaxTotalItems = _normalizeLimit(
      maxTotalItems,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxTotalItems,
      1,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxTotalItems
    );
    const safeMaxTotalChars = _normalizeLimit(
      maxTotalChars,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxTotalChars,
      1000,
      MEMORY_TOPIC_RECALL_DEFAULTS.maxTotalChars
    );

    const topicPolicyCheck = this.assertTopicGroupingAllowed({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      topicKey: normalizedTopicKey,
      limits: {
        maxItems: safeMaxTotalItems,
      },
      safety: {
        crossUserGroupingAllowed: false,
        crossGroupGroupingAllowed: false,
        rawPromptInjectionAllowed: false,
        aiClusteringActive: false,
        vectorSearchActive: false,
      },
    });

    if (topicPolicyCheck?.ok !== true) {
      return this._baseResult({
        ok: false,
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        topicKey: normalizedTopicKey,
        reason: "topic_grouping_policy_failed",
        errors: topicPolicyCheck?.errors || ["topic_policy_failed"],
      });
    }

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      topicKey: normalizedTopicKey,
      topicLabel: _safeStr(topicLabel || topicKey).trim() || normalizedTopicKey,
      requestedBy: requestedByStr,
      requestedSources: {
        archive: includeArchive === true,
        digest: includeDigest !== false,
        confirmed: includeConfirmed !== false,
      },
      limits: {
        maxArchiveItems: includeArchive === true ? safeMaxArchiveItems : 0,
        maxDigestItems: includeDigest !== false ? safeMaxDigestItems : 0,
        maxConfirmedItems: includeConfirmed !== false ? safeMaxConfirmedItems : 0,
        maxTotalItems: safeMaxTotalItems,
        maxTotalChars: safeMaxTotalChars,
      },
      safety: {
        rawArchivePromptAllowed: false,
        promptFacing: false,
        crossUserRecallAllowed: false,
        crossGroupRecallAllowed: false,
        failClosedOnAmbiguousTopic: true,
      },
      metadata: {
        ...safeMeta,
        policyLayer: "topic_based_recall_restore",
        serviceVersion: MEMORY_TOPIC_RECALL_SERVICE_VERSION,
      },
      note: "restore_request_only_no_runtime_read_no_prompt_injection",
    });
  }

  selectTopicRestoreContext(request = {}) {
    const req = _safeObj(request);
    const errors = [];

    if (req.ok !== true) errors.push("invalid_recall_request");
    if (!req.chatId) errors.push("missing_chatId");
    if (!req.topicKey) errors.push("missing_topicKey");
    if (req?.safety?.rawArchivePromptAllowed === true) {
      errors.push("raw_archive_prompt_allowed");
    }
    if (req?.safety?.crossUserRecallAllowed === true) {
      errors.push("cross_user_recall_allowed");
    }
    if (req?.safety?.crossGroupRecallAllowed === true) {
      errors.push("cross_group_recall_allowed");
    }

    if (errors.length > 0) {
      return this._baseResult({
        ok: false,
        reason: "topic_restore_request_failed_policy",
        errors,
        items: [],
        total: 0,
      });
    }

    return this._baseResult({
      chatId: req.chatId,
      globalUserId: req.globalUserId || null,
      topicKey: req.topicKey,
      requestedSources: req.requestedSources || {},
      limits: req.limits || {},
      items: [],
      total: 0,
      promptPackage: null,
      reason: "topic_restore_skeleton_no_runtime_read",
    });
  }

  status() {
    return this._baseResult({
      methods: [
        "getPolicy",
        "buildTopicRecallRequest",
        "selectTopicRestoreContext",
        "status",
      ],
      defaults: MEMORY_TOPIC_RECALL_DEFAULTS,
      reason: "topic_recall_skeleton_active_no_runtime_read",
    });
  }
}

export default MemoryTopicRecallService;
