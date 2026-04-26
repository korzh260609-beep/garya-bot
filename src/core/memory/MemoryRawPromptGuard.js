// src/core/memory/MemoryRawPromptGuard.js
// STAGE 7.8.10 — NO-UNCONTROLLED-RAW-DIALOGUE-PROMPT GUARD (SKELETON)
//
// Goal:
// - explicitly block raw dialogue from entering prompts without an approved bounded restore path
// - provide deterministic checks for future prompt packages
// - fail closed on ambiguous raw dialogue sources
// - keep guard separated from AI logic and storage
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO DB reads/writes here.
// - NO AI logic here.
// - NO prompt construction here.
// - This module is deterministic guard/diagnostic only.

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

function _safeArr(x) {
  return Array.isArray(x) ? x : [];
}

export const MEMORY_RAW_PROMPT_GUARD_VERSION =
  "memory-raw-prompt-guard-7.8.10-001";

export const MEMORY_RAW_PROMPT_GUARD_DEFAULTS = Object.freeze({
  rawDialoguePromptAllowedByDefault: false,
  requireApprovedRestorePath: true,
  requireBoundedItems: true,
  requireSourceLabels: true,
  requireLayerLabels: true,
  failClosedOnUnknownLayer: true,
  failClosedOnAmbiguousRawSource: true,
  maxRawItems: 20,
  maxTotalChars: 12000,
});

function _detectRawDialogueItem(item = {}) {
  const obj = _safeObj(item);
  const meta = _safeObj(obj.metadata);
  const layer = _safeStr(obj.memoryLayer || meta.memoryLayer).trim();
  const archiveKind = _safeStr(obj.archiveKind || meta.archiveKind).trim();
  const kind = _safeStr(obj.kind || meta.kind).trim();
  const source = _safeStr(obj.source || meta.source).trim();

  return (
    layer === "raw_dialogue_archive" ||
    archiveKind === "raw_dialogue" ||
    kind === "raw_dialogue" ||
    source === "raw_dialogue" ||
    source === "chat_memory_raw"
  );
}

function _itemChars(item = {}) {
  const obj = _safeObj(item);
  const content = _safeStr(obj.content || obj.text || obj.summary || obj.value);
  return content.length;
}

export class MemoryRawPromptGuard {
  constructor({ logger = console, getEnabled = () => false, contractVersion = 1 } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
  }

  _baseResult(extra = {}) {
    return {
      ok: true,
      enabled: !!this.getEnabled(),
      service: "MemoryRawPromptGuard",
      version: MEMORY_RAW_PROMPT_GUARD_VERSION,
      contractVersion: this.contractVersion,
      rawDialoguePromptAllowedByDefault: false,
      promptConstruction: false,
      dbWrites: false,
      dbReads: false,
      aiLogic: false,
      ...extra,
    };
  }

  getPolicy() {
    return this._baseResult({
      defaults: MEMORY_RAW_PROMPT_GUARD_DEFAULTS,
      invariants: [
        "raw dialogue must not enter prompt by default",
        "raw dialogue requires approved bounded restore path",
        "raw dialogue prompt package must include source labels",
        "raw dialogue prompt package must include memory layer labels",
        "unknown memory layer must fail closed",
        "ambiguous raw source must fail closed",
      ],
      forbiddenActions: [
        "unbounded_raw_dialogue_prompt",
        "unlabeled_raw_dialogue_prompt",
        "unknown_layer_prompt_injection",
        "cross_user_raw_dialogue_prompt",
        "cross_group_raw_dialogue_prompt",
      ],
    });
  }

  assertRawPromptAllowed({
    items = [],
    approvedRestorePath = false,
    bounded = false,
    source = null,
    maxItems = null,
    maxTotalChars = null,
    metadata = {},
  } = {}) {
    const errors = [];
    const warnings = [];
    const safeItems = _safeArr(items);
    const safeMeta = _safeObj(metadata);
    const sourceStr = _safeStr(source || safeMeta.source).trim() || "unknown";
    const rawItems = safeItems.filter((item) => _detectRawDialogueItem(item));
    const totalChars = safeItems.reduce((sum, item) => sum + _itemChars(item), 0);
    const safeMaxItems = Number.isFinite(Number(maxItems))
      ? Number(maxItems)
      : MEMORY_RAW_PROMPT_GUARD_DEFAULTS.maxRawItems;
    const safeMaxTotalChars = Number.isFinite(Number(maxTotalChars))
      ? Number(maxTotalChars)
      : MEMORY_RAW_PROMPT_GUARD_DEFAULTS.maxTotalChars;

    if (rawItems.length > 0 && approvedRestorePath !== true) {
      errors.push("raw_dialogue_without_approved_restore_path");
    }

    if (rawItems.length > 0 && bounded !== true) {
      errors.push("raw_dialogue_without_bounded_restore");
    }

    if (rawItems.length > safeMaxItems) {
      errors.push("raw_dialogue_items_exceed_limit");
    }

    if (totalChars > safeMaxTotalChars) {
      errors.push("prompt_items_chars_exceed_limit");
    }

    for (const item of rawItems) {
      const obj = _safeObj(item);
      const meta = _safeObj(obj.metadata);
      const layer = _safeStr(obj.memoryLayer || meta.memoryLayer).trim();
      const itemSource = _safeStr(obj.source || meta.source).trim();
      if (!layer) errors.push("raw_dialogue_missing_layer_label");
      if (!itemSource) errors.push("raw_dialogue_missing_source_label");
      if (meta.rawPromptInjectionAllowed === true || obj.rawPromptInjectionAllowed === true) {
        errors.push("raw_prompt_injection_flag_true");
      }
    }

    const unknownLayerItems = safeItems.filter((item) => {
      const obj = _safeObj(item);
      const meta = _safeObj(obj.metadata);
      const layer = _safeStr(obj.memoryLayer || meta.memoryLayer).trim();
      return !layer;
    });

    if (unknownLayerItems.length > 0 && safeMeta.allowUnknownLayer !== true) {
      errors.push("unknown_memory_layer_in_prompt_items");
    }

    if (safeItems.length === 0) {
      warnings.push("empty_prompt_items");
    }

    return this._baseResult({
      ok: errors.length === 0,
      source: sourceStr,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      stats: {
        items: safeItems.length,
        rawItems: rawItems.length,
        totalChars,
        maxItems: safeMaxItems,
        maxTotalChars: safeMaxTotalChars,
      },
      decision: errors.length === 0 ? "ALLOW_BOUNDED_PACKAGE" : "BLOCK_RAW_PROMPT",
    });
  }

  status() {
    return this._baseResult({
      methods: ["getPolicy", "assertRawPromptAllowed", "status"],
      defaults: MEMORY_RAW_PROMPT_GUARD_DEFAULTS,
      reason: "raw_prompt_guard_active_read_only",
    });
  }
}

export default MemoryRawPromptGuard;
