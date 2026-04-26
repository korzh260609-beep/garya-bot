// src/core/memory/MemoryTopicDigestService.js
// STAGE 7.8.2 — TOPIC DIGEST LAYER (SKELETON)
//
// Goal:
// - create a safe contract for compact topic digest operations
// - keep topic digest separated from raw dialogue archive
// - keep topic digest separated from confirmed long-term memory
// - prepare future bounded summaries by topic/theme
// - prevent digest from becoming uncontrolled AI-generated memory
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes in this skeleton.
// - NO AI generation here.
// - NO automatic prompt injection.
// - NO direct use from handlers; public access goes through MemoryService only.
// - This skeleton does not change current memory runtime behavior.
//
// Runtime note:
// - Storage/write path is intentionally inactive in 7.8.2.
// - Digest generation rules belong to 7.8.6 and require separate approval.
// - Runtime topic digest minimum belongs to 7.9.4 and requires separate approval.

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

function _normalizeLimit(value, fallback = 20, min = 1, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _normalizeTopicKey(value) {
  const v = _safeStr(value).trim();
  return v || null;
}

export class MemoryTopicDigestService {
  static DIGEST_LAYER = "topic_digest";
  static STORAGE_ACTIVE = false;
  static PROMPT_FACING = false;
  static AI_GENERATION_ACTIVE = false;

  constructor({
    logger = console,
    getEnabled = () => false,
    contractVersion = 1,
  } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
  }

  _baseResult(extra = {}) {
    return {
      ok: true,
      enabled: !!this.getEnabled(),
      digestLayer: MemoryTopicDigestService.DIGEST_LAYER,
      storageActive: MemoryTopicDigestService.STORAGE_ACTIVE,
      aiGenerationActive: MemoryTopicDigestService.AI_GENERATION_ACTIVE,
      restoreCapable: true,
      promptFacing: MemoryTopicDigestService.PROMPT_FACING,
      rawPromptInjectionAllowed: false,
      confirmedMemory: false,
      archiveMemory: false,
      backend: "chat_memory",
      contractVersion: this.contractVersion,
      ...extra,
    };
  }

  async upsertTopicDigest({
    globalUserId = null,
    chatId = null,
    topicKey = null,
    summary = null,
    sourceRefs = [],
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const topicKeyStr = _normalizeTopicKey(topicKey);
    const summaryStr = typeof summary === "string" ? summary.trim() : _safeStr(summary).trim();
    const safeMeta = _safeObj(metadata);
    const safeSourceRefs = Array.isArray(sourceRefs)
      ? sourceRefs.map((x) => _safeStr(x).trim()).filter(Boolean)
      : [];

    if (!chatIdStr) {
      return this._baseResult({
        stored: false,
        reason: "missing_chatId",
      });
    }

    if (!topicKeyStr || !summaryStr) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        stored: false,
        reason: "invalid_topic_digest_input",
      });
    }

    if (!this.getEnabled()) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        topicKey: topicKeyStr,
        stored: false,
        reason: "memory_disabled",
      });
    }

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      topicKey: topicKeyStr,
      size: summaryStr.length,
      sourceRefs: safeSourceRefs,
      metadata: {
        ...safeMeta,
        memoryLayer: MemoryTopicDigestService.DIGEST_LAYER,
        digestKind: "topic_summary",
        promptFacing: false,
        rawPromptInjectionAllowed: false,
        source: safeMeta.source || "MemoryTopicDigestService.upsertTopicDigest",
      },
      schemaVersion,
      stored: false,
      reason: "topic_digest_skeleton_no_storage",
    });
  }

  async selectTopicDigestForRestore({
    globalUserId = null,
    chatId = null,
    topicKey = null,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const topicKeyStr = _normalizeTopicKey(topicKey);
    const safeLimit = _normalizeLimit(limit, 20, 1, 100);

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        topicKey: topicKeyStr,
        limit: safeLimit,
        items: [],
        total: 0,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      });
    }

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      topicKey: topicKeyStr,
      limit: safeLimit,
      items: [],
      total: 0,
      reason: "topic_digest_restore_skeleton_no_storage",
    });
  }

  async listTopicDigests({
    globalUserId = null,
    chatId = null,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const safeLimit = _normalizeLimit(limit, 20, 1, 100);

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        limit: safeLimit,
        items: [],
        total: 0,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      });
    }

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      limit: safeLimit,
      items: [],
      total: 0,
      reason: "topic_digest_list_skeleton_no_storage",
    });
  }

  status() {
    return this._baseResult({
      service: "MemoryTopicDigestService",
      methods: [
        "upsertTopicDigest",
        "selectTopicDigestForRestore",
        "listTopicDigests",
        "status",
      ],
      reason: "topic_digest_skeleton_active_no_storage",
    });
  }
}

export default MemoryTopicDigestService;
