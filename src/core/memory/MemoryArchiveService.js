// src/core/memory/MemoryArchiveService.js
// STAGE 7.8.1 — RAW DIALOGUE ARCHIVE LAYER (SKELETON)
//
// Goal:
// - create a safe contract for raw dialogue archive operations
// - keep raw archive separated from confirmed long-term memory
// - keep raw archive separated from future topic digest memory
// - make archive restore-capable by contract
// - prevent raw archive from becoming uncontrolled prompt memory
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes in this skeleton.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO direct use from handlers; public access goes through MemoryService only.
// - This skeleton does not change current memory runtime behavior.
//
// Runtime note:
// - Storage/write path is intentionally inactive in 7.8.1.
// - 7.9.3 may add bounded archive write path later with explicit approval.

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

function _normalizeLimit(value, fallback = 20, min = 1, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _normalizeTransport(t) {
  const v = _safeStr(t).trim();
  return v || "telegram";
}

export class MemoryArchiveService {
  static ARCHIVE_LAYER = "raw_dialogue_archive";
  static STORAGE_ACTIVE = false;
  static PROMPT_FACING = false;

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
      archiveLayer: MemoryArchiveService.ARCHIVE_LAYER,
      storageActive: MemoryArchiveService.STORAGE_ACTIVE,
      restoreCapable: true,
      promptFacing: MemoryArchiveService.PROMPT_FACING,
      rawPromptInjectionAllowed: false,
      confirmedMemory: false,
      digestMemory: false,
      backend: "chat_memory",
      contractVersion: this.contractVersion,
      ...extra,
    };
  }

  async archiveMessage({
    globalUserId = null,
    chatId = null,
    role = null,
    content = null,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const roleStr = _safeStr(role).trim();
    const contentStr = typeof content === "string" ? content : _safeStr(content);
    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);

    if (!chatIdStr) {
      return this._baseResult({
        stored: false,
        reason: "missing_chatId",
      });
    }

    if (!roleStr || !contentStr) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        stored: false,
        reason: "invalid_archive_message_input",
      });
    }

    if (!this.getEnabled()) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        role: roleStr,
        stored: false,
        reason: "memory_disabled",
      });
    }

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      role: roleStr,
      size: contentStr.length,
      transport: safeTransport,
      metadata: {
        ...safeMeta,
        memoryLayer: MemoryArchiveService.ARCHIVE_LAYER,
        archiveKind: "raw_dialogue",
        promptFacing: false,
        rawPromptInjectionAllowed: false,
        source: safeMeta.source || "MemoryArchiveService.archiveMessage",
      },
      schemaVersion,
      stored: false,
      reason: "archive_skeleton_no_storage",
    });
  }

  async archivePair({
    globalUserId = null,
    chatId = null,
    userText = null,
    assistantText = null,
    transport = null,
    metadata = {},
    schemaVersion = null,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const u = typeof userText === "string" ? userText : _safeStr(userText);
    const a =
      typeof assistantText === "string" ? assistantText : _safeStr(assistantText);

    if (!chatIdStr) {
      return this._baseResult({
        stored: false,
        reason: "missing_chatId",
      });
    }

    if (!u && !a) {
      return this._baseResult({
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        stored: false,
        reason: "empty_archive_pair",
      });
    }

    const userArchive = u
      ? await this.archiveMessage({
          globalUserId,
          chatId: chatIdStr,
          role: "user",
          content: u,
          transport,
          metadata,
          schemaVersion,
        })
      : null;

    const assistantArchive = a
      ? await this.archiveMessage({
          globalUserId,
          chatId: chatIdStr,
          role: "assistant",
          content: a,
          transport,
          metadata,
          schemaVersion,
        })
      : null;

    return this._baseResult({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      stored: false,
      pair: {
        user: userArchive,
        assistant: assistantArchive,
      },
      reason: "archive_pair_skeleton_no_storage",
    });
  }

  async selectArchiveForRestore({
    globalUserId = null,
    chatId = null,
    topicKey = null,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);
    const topicKeyStr = _safeStr(topicKey).trim() || null;

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
      reason: "archive_restore_skeleton_no_storage",
    });
  }

  status() {
    return this._baseResult({
      service: "MemoryArchiveService",
      methods: [
        "archiveMessage",
        "archivePair",
        "selectArchiveForRestore",
        "status",
      ],
      reason: "raw_archive_skeleton_active_no_storage",
    });
  }
}

export default MemoryArchiveService;
