// src/core/memory/MemoryConfirmedRestoreService.js
// STAGE 7.9.3 — Controlled Confirmed Memory Restore Skeleton
//
// Purpose:
// - build a safe confirmed-memory restore interface for future AI prompt context
// - consume MemoryService.selectLongTermContext() through an injected MemoryService instance
// - return bounded, attributed, structured confirmed facts
//
// IMPORTANT SAFETY RULES:
// - NO schema changes.
// - NO AI logic.
// - NO prompt injection.
// - NO raw dialogue archive restore.
// - NO topic digest restore.
// - NO production answer behavior change.
// - This service prepares a controlled restore package only.

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function safeObj(value) {
  try {
    if (!value) return {};
    if (typeof value === "object") return value;
    return { value: String(value) };
  } catch (_) {
    return {};
  }
}

function normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];

  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = safeStr(item).trim();
    if (!s) continue;

    const key = s.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(s);
  }

  return out;
}

function normalizeDomainSlots(value) {
  if (!Array.isArray(value)) return [];

  const out = [];
  const seen = new Set();

  for (const item of value) {
    const rememberDomain = safeStr(item?.rememberDomain).trim();
    const rememberSlot = safeStr(item?.rememberSlot).trim();
    if (!rememberDomain || !rememberSlot) continue;

    const key = `${rememberDomain.toLowerCase()}:${rememberSlot.toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ rememberDomain, rememberSlot });
  }

  return out;
}

function truncateText(value, maxChars) {
  const text = safeStr(value).trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function isAllowed(value, allowedList) {
  const v = safeStr(value).trim().toLowerCase();
  if (!v) return false;
  if (!allowedList.length) return true;
  return allowedList.map((item) => item.toLowerCase()).includes(v);
}

export const MEMORY_CONFIRMED_RESTORE_VERSION =
  "memory-confirmed-restore-7.9.3-001";

export const MEMORY_CONFIRMED_RESTORE_DEFAULTS = Object.freeze({
  maxItems: 8,
  maxChars: 1200,
  maxItemChars: 300,
  requireExplicitSelector: true,
  promptFacing: false,
  allowRawDialogue: false,
  allowTopicDigest: false,
  allowArchive: false,
  allowUnconfirmed: false,
  includeRawContent: false,
  includeMetadata: false,
});

export class MemoryConfirmedRestoreService {
  constructor({
    memoryService = null,
    logger = console,
    getEnabled = () => false,
    contractVersion = 1,
  } = {}) {
    this.memoryService = memoryService || null;
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
  }

  _baseResult(extra = {}) {
    return {
      ok: true,
      enabled: !!this.getEnabled(),
      service: "MemoryConfirmedRestoreService",
      version: MEMORY_CONFIRMED_RESTORE_VERSION,
      contractVersion: this.contractVersion,
      promptFacing: false,
      aiLogic: false,
      schemaChanges: false,
      productionBehaviorChange: false,
      rawDialogueIncluded: false,
      topicDigestIncluded: false,
      archiveIncluded: false,
      ...extra,
    };
  }

  getPolicy() {
    return this._baseResult({
      defaults: MEMORY_CONFIRMED_RESTORE_DEFAULTS,
      invariants: [
        "restore package must contain confirmed long-term memory only",
        "restore package must be bounded by item count and characters",
        "restore package must be structured and attributed",
        "raw dialogue archive must not be included",
        "topic digest must not be included",
        "restore package is not automatically injected into prompts",
        "explicit selectors are required to avoid dumping all memory",
      ],
      forbiddenActions: [
        "automatic_prompt_injection",
        "raw_dialogue_prompt_restore",
        "topic_digest_prompt_restore",
        "unbounded_confirmed_memory_restore",
        "unselected_memory_dump",
        "schema_change",
        "ai_summarization_inside_restore_service",
      ],
    });
  }

  buildConfirmedRestoreRequest({
    chatId = null,
    globalUserId = null,
    rememberTypes = [],
    rememberKeys = [],
    rememberDomains = [],
    rememberSlots = [],
    domainSlots = [],
    allowedTypes = [],
    allowedDomains = [],
    maxItems = MEMORY_CONFIRMED_RESTORE_DEFAULTS.maxItems,
    maxChars = MEMORY_CONFIRMED_RESTORE_DEFAULTS.maxChars,
    maxItemChars = MEMORY_CONFIRMED_RESTORE_DEFAULTS.maxItemChars,
    purpose = "diagnostic",
  } = {}) {
    const safeMaxItems = normalizeLimit(maxItems, 8, 1, 30);
    const safeMaxChars = normalizeLimit(maxChars, 1200, 100, 5000);
    const safeMaxItemChars = normalizeLimit(maxItemChars, 300, 50, 1000);

    const typeList = normalizeStringList(rememberTypes);
    const keyList = normalizeStringList(rememberKeys);
    const domainList = normalizeStringList(rememberDomains);
    const slotList = normalizeStringList(rememberSlots);
    const domainSlotList = normalizeDomainSlots(domainSlots);
    const allowedTypeList = normalizeStringList(allowedTypes);
    const allowedDomainList = normalizeStringList(allowedDomains);

    return this._baseResult({
      request: {
        chatId: chatId ? String(chatId) : null,
        globalUserId: globalUserId || null,
        purpose: safeStr(purpose).trim() || "diagnostic",
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        allowedTypes: allowedTypeList,
        allowedDomains: allowedDomainList,
        limits: {
          maxItems: safeMaxItems,
          maxChars: safeMaxChars,
          maxItemChars: safeMaxItemChars,
        },
      },
    });
  }

  _hasExplicitSelector(request = {}) {
    return (
      request.rememberTypes.length > 0 ||
      request.rememberKeys.length > 0 ||
      request.rememberDomains.length > 0 ||
      request.rememberSlots.length > 0 ||
      request.domainSlots.length > 0
    );
  }

  _normalizeItem(item = {}, request = {}) {
    const metadata = safeObj(item?.metadata);
    const memoryType = safeStr(item?.memoryType || metadata?.memoryType).trim();
    const rememberKey = safeStr(item?.rememberKey || metadata?.rememberKey).trim();
    const rememberType = safeStr(item?.rememberType || metadata?.rememberType).trim();
    const rememberDomain = safeStr(item?.rememberDomain || metadata?.rememberDomain).trim();
    const rememberSlot = safeStr(item?.rememberSlot || metadata?.rememberSlot).trim();
    const value = truncateText(item?.value || item?.content, request.limits.maxItemChars);

    return {
      id: item?.id ?? null,
      key: rememberKey,
      value,
      type: rememberType,
      domain: rememberDomain,
      slot: rememberSlot,
      canonicalKey:
        safeStr(item?.rememberCanonicalKey || metadata?.rememberCanonicalKey).trim() ||
        null,
      source: safeStr(item?.source || metadata?.source).trim() || null,
      createdAt: item?.createdAt || null,
      globalUserId: item?.globalUserId || null,
      memoryType,
      explicit:
        item?.explicit === true ||
        metadata?.explicit === true ||
        safeStr(metadata?.explicit).trim() === "true",
      attribution: {
        owner: item?.globalUserId || request.globalUserId || null,
        chatId: item?.chatId || request.chatId || null,
        source: safeStr(item?.source || metadata?.source).trim() || "confirmed_memory",
      },
    };
  }

  _isSafeConfirmedItem(item = {}, request = {}) {
    if (item.memoryType !== "long_term") return false;
    if (item.explicit !== true) return false;
    if (!item.key || !item.value) return false;
    if (!isAllowed(item.type, request.allowedTypes)) return false;
    if (!isAllowed(item.domain, request.allowedDomains)) return false;
    return true;
  }

  _applyCharBudget(items = [], maxChars) {
    const out = [];
    let usedChars = 0;

    for (const item of items) {
      const itemChars =
        safeStr(item.key).length +
        safeStr(item.value).length +
        safeStr(item.type).length +
        safeStr(item.domain).length +
        safeStr(item.slot).length;

      if (out.length > 0 && usedChars + itemChars > maxChars) break;

      out.push(item);
      usedChars += itemChars;
    }

    return {
      items: out,
      usedChars,
      truncatedByChars: out.length < items.length,
    };
  }

  async selectConfirmedRestoreContext(args = {}) {
    const built = this.buildConfirmedRestoreRequest(args);
    const request = built.request;

    if (!this.getEnabled()) {
      return this._baseResult({
        enabled: false,
        request,
        items: [],
        total: 0,
        reason: "memory_disabled",
      });
    }

    if (!request.chatId) {
      return this._baseResult({
        request,
        items: [],
        total: 0,
        reason: "missing_chatId",
      });
    }

    if (!this._hasExplicitSelector(request)) {
      return this._baseResult({
        ok: false,
        request,
        items: [],
        total: 0,
        reason: "empty_restore_selector",
      });
    }

    if (
      !this.memoryService ||
      typeof this.memoryService.selectLongTermContext !== "function"
    ) {
      return this._baseResult({
        ok: false,
        request,
        items: [],
        total: 0,
        reason: "memory_service_selector_unavailable",
      });
    }

    try {
      const selectorResult = await this.memoryService.selectLongTermContext({
        chatId: request.chatId,
        globalUserId: request.globalUserId,
        rememberTypes: request.rememberTypes,
        rememberKeys: request.rememberKeys,
        rememberDomains: request.rememberDomains,
        rememberSlots: request.rememberSlots,
        domainSlots: request.domainSlots,
        perTypeLimit: request.limits.maxItems,
        perKeyLimit: request.limits.maxItems,
        perDomainLimit: request.limits.maxItems,
        perSlotLimit: request.limits.maxItems,
        perDomainSlotLimit: request.limits.maxItems,
        totalLimit: request.limits.maxItems,
      });

      if (selectorResult?.ok !== true) {
        return this._baseResult({
          ok: false,
          request,
          selector: {
            ok: false,
            reason: selectorResult?.reason || "unknown_selector_failure",
          },
          items: [],
          total: 0,
          reason: "confirmed_restore_selector_failed",
        });
      }

      const normalized = (selectorResult.items || [])
        .map((item) => this._normalizeItem(item, request))
        .filter((item) => this._isSafeConfirmedItem(item, request));

      const budgeted = this._applyCharBudget(
        normalized.slice(0, request.limits.maxItems),
        request.limits.maxChars
      );

      return this._baseResult({
        request,
        selector: {
          ok: true,
          total: selectorResult.total || 0,
          backend: selectorResult.backend || "chat_memory",
        },
        items: budgeted.items,
        total: budgeted.items.length,
        limits: request.limits,
        warnings: [
          ...(budgeted.truncatedByChars ? ["restore_context_truncated_by_char_budget"] : []),
          ...(normalized.length < Number(selectorResult.total || 0)
            ? ["unsafe_or_disallowed_items_filtered"]
            : []),
        ],
        reason: "confirmed_restore_context_selected",
      });
    } catch (error) {
      this.logger.error("selectConfirmedRestoreContext failed", {
        chatId: request.chatId,
        globalUserId: request.globalUserId,
        error: error?.message || error,
      });

      return this._baseResult({
        ok: false,
        request,
        items: [],
        total: 0,
        reason: "confirmed_restore_context_failed",
        error: error?.message || String(error),
      });
    }
  }

  status() {
    return this._baseResult({
      methods: [
        "getPolicy",
        "buildConfirmedRestoreRequest",
        "selectConfirmedRestoreContext",
        "status",
      ],
      defaults: MEMORY_CONFIRMED_RESTORE_DEFAULTS,
      reason: "confirmed_restore_skeleton_active_not_prompt_facing",
    });
  }
}

export default MemoryConfirmedRestoreService;
