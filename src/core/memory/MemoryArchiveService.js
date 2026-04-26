// src/core/memory/MemoryArchiveService.js
// STAGE 7.8.1 — RAW DIALOGUE ARCHIVE LAYER (SKELETON)
// STAGE 7.9.3 — BOUNDED ARCHIVE WRITE PATH
//
// Goal:
// - create a safe contract for raw dialogue archive operations
// - keep raw archive separated from confirmed long-term memory
// - keep raw archive separated from future topic digest memory
// - make archive restore-capable by contract
// - prevent raw archive from becoming uncontrolled prompt memory
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO direct use from handlers; public access goes through MemoryService only.
// - Archive writes are bounded and metadata-tagged.
// - Archive writes fail closed if metadata support is unavailable.

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

function _normalizeRole(role) {
  const value = _safeStr(role).trim().toLowerCase();
  if (value === "user" || value === "assistant" || value === "system") return value;
  return "";
}

function _normalizeSchemaVersion(sv) {
  const n = Number(sv);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

function _truncateContent(content, maxChars) {
  const text = typeof content === "string" ? content : _safeStr(content);
  const clean = text.trim();
  if (clean.length <= maxChars) {
    return {
      content: clean,
      truncated: false,
      originalSize: clean.length,
      storedSize: clean.length,
    };
  }

  const stored = clean.slice(0, Math.max(0, maxChars - 1)) + "…";
  return {
    content: stored,
    truncated: true,
    originalSize: clean.length,
    storedSize: stored.length,
  };
}

export const MEMORY_ARCHIVE_LIMITS = Object.freeze({
  maxMessageChars: 2000,
  maxPairChars: 4000,
});

export class MemoryArchiveService {
  static ARCHIVE_LAYER = "raw_dialogue_archive";
  static STORAGE_ACTIVE = true;
  static PROMPT_FACING = false;

  constructor({
    logger = console,
    getEnabled = () => false,
    contractVersion = 1,
    chatAdapter = null,
  } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
    this.chatAdapter = chatAdapter || null;
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
      limits: MEMORY_ARCHIVE_LIMITS,
      ...extra,
    };
  }

  async _canStoreArchive() {
    if (!this.chatAdapter || typeof this.chatAdapter.saveMessage !== "function") {
      return {
        ok: false,
        reason: "chat_adapter_unavailable",
      };
    }

    if (typeof this.chatAdapter.supportsMetadata !== "function") {
      return {
        ok: false,
        reason: "metadata_support_check_unavailable",
      };
    }

    const hasMetadata = await this.chatAdapter.supportsMetadata();
    if (!hasMetadata) {
      return {
        ok: false,
        reason: "metadata_required_for_archive_write",
      };
    }

    return { ok: true };
  }

  async archiveMessage({
    globalUserId = null,
    chatId = null,
    role = null,
    content = null,
    transport = null,
    metadata = {},
    schemaVersion = null,
    maxChars = MEMORY_ARCHIVE_LIMITS.maxMessageChars,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const roleStr = _normalizeRole(role);
    const safeTransport = _normalizeTransport(transport);
    const safeMeta = _safeObj(metadata);
    const safeMaxChars = _normalizeLimit(maxChars, MEMORY_ARCHIVE_LIMITS.maxMessageChars, 1, MEMORY_ARCHIVE_LIMITS.maxMessageChars);
    const prepared = _truncateContent(content, safeMaxChars);

    if (!chatIdStr) {
      return this._baseResult({
        stored: false,
        reason: "missing_chatId",
      });
    }

    if (!roleStr || !prepared.content) {
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

    const canStore = await this._canStoreArchive();
    if (canStore.ok !== true) {
      return this._baseResult({
        ok: false,
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        role: roleStr,
        stored: false,
        reason: canStore.reason || "archive_write_not_available",
      });
    }

    const archiveMetadata = {
      ...safeMeta,
      memoryLayer: MemoryArchiveService.ARCHIVE_LAYER,
      archiveKind: "raw_dialogue",
      memoryType: "archive",
      promptFacing: false,
      rawPromptInjectionAllowed: false,
      confirmedMemory: false,
      digestMemory: false,
      archiveTruncated: prepared.truncated,
      archiveOriginalSize: prepared.originalSize,
      archiveStoredSize: prepared.storedSize,
      archiveMaxChars: safeMaxChars,
      source: safeMeta.source || "MemoryArchiveService.archiveMessage",
    };

    const writeRes = await this.chatAdapter.saveMessage({
      chatId: chatIdStr,
      role: roleStr,
      content: prepared.content,
      globalUserId: globalUserId || null,
      options: {
        transport: safeTransport,
        metadata: archiveMetadata,
        schemaVersion: _normalizeSchemaVersion(schemaVersion),
      },
    });

    const ok = writeRes?.ok === true;

    return this._baseResult({
      ok,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      role: roleStr,
      size: prepared.storedSize,
      originalSize: prepared.originalSize,
      truncated: prepared.truncated,
      transport: safeTransport,
      metadata: archiveMetadata,
      schemaVersion: _normalizeSchemaVersion(schemaVersion),
      stored: ok,
      reason: ok ? "archive_message_saved" : writeRes?.reason || "archive_message_save_failed",
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
    maxPairChars = MEMORY_ARCHIVE_LIMITS.maxPairChars,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const u = typeof userText === "string" ? userText : _safeStr(userText);
    const a =
      typeof assistantText === "string" ? assistantText : _safeStr(assistantText);
    const safePairLimit = _normalizeLimit(maxPairChars, MEMORY_ARCHIVE_LIMITS.maxPairChars, 2, MEMORY_ARCHIVE_LIMITS.maxPairChars);
    const perMessageLimit = Math.max(1, Math.floor(safePairLimit / 2));

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

    const pairMeta = {
      ..._safeObj(metadata),
      archivePair: true,
      archivePairMaxChars: safePairLimit,
    };

    const userArchive = u
      ? await this.archiveMessage({
          globalUserId,
          chatId: chatIdStr,
          role: "user",
          content: u,
          transport,
          metadata: pairMeta,
          schemaVersion,
          maxChars: perMessageLimit,
        })
      : null;

    const assistantArchive = a
      ? await this.archiveMessage({
          globalUserId,
          chatId: chatIdStr,
          role: "assistant",
          content: a,
          transport,
          metadata: pairMeta,
          schemaVersion,
          maxChars: perMessageLimit,
        })
      : null;

    const stored =
      (!u || userArchive?.stored === true) &&
      (!a || assistantArchive?.stored === true);
    const ok =
      (!u || userArchive?.ok === true) &&
      (!a || assistantArchive?.ok === true);

    return this._baseResult({
      ok,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      stored,
      pair: {
        user: userArchive,
        assistant: assistantArchive,
      },
      reason: stored ? "archive_pair_saved" : "archive_pair_not_fully_saved",
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
      reason: "archive_restore_not_prompt_facing",
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
      reason: "raw_archive_bounded_write_active_not_prompt_facing",
    });
  }
}

export default MemoryArchiveService;
