// src/core/memory/MemoryConfirmedGuard.js
// STAGE 7.8.11 — DUPLICATE / CONFLICT GUARD FOR CONFIRMED MEMORY (SKELETON)
//
// Goal:
// - provide deterministic duplicate/conflict checks for future confirmed memory writes
// - keep guard separated from DB reads/writes
// - prevent silent conflicts in explicit long-term memory
// - prepare a safe approved path for later remember() hardening
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO DB reads/writes here.
// - NO AI logic here.
// - NO automatic confirmed memory writes here.
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

function _normalizeText(value) {
  return _safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/["'`]/g, "");
}

function _normalizeKey(value) {
  return _safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ".")
    .replace(/[^a-z0-9а-яёіїєґ.-]+/gi, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export const MEMORY_CONFIRMED_GUARD_VERSION =
  "memory-confirmed-guard-7.8.11-001";

export const MEMORY_CONFIRMED_GUARD_DEFAULTS = Object.freeze({
  duplicateAction: "block_or_noop",
  conflictAction: "block_manual_review",
  requireKey: true,
  requireValue: true,
  requireExplicitIntent: true,
  allowSilentOverwrite: false,
  allowArchiveAsConfirmed: false,
  allowDigestAsConfirmed: false,
  failClosedOnAmbiguousCandidate: true,
});

export class MemoryConfirmedGuard {
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
      service: "MemoryConfirmedGuard",
      version: MEMORY_CONFIRMED_GUARD_VERSION,
      contractVersion: this.contractVersion,
      dbReads: false,
      dbWrites: false,
      aiLogic: false,
      automaticWrites: false,
      ...extra,
    };
  }

  getPolicy() {
    return this._baseResult({
      defaults: MEMORY_CONFIRMED_GUARD_DEFAULTS,
      invariants: [
        "confirmed memory requires explicit intent",
        "confirmed memory candidate must have a stable key",
        "confirmed memory candidate must have a non-empty value",
        "duplicate confirmed memory must not be silently rewritten",
        "conflicting confirmed memory must fail into manual review",
        "raw archive and topic digest must not be promoted to confirmed memory automatically",
        "silent overwrite is forbidden",
      ],
      forbiddenActions: [
        "silent_confirmed_memory_overwrite",
        "automatic_archive_to_confirmed_memory",
        "automatic_digest_to_confirmed_memory",
        "unkeyed_confirmed_memory_write",
        "ambiguous_confirmed_memory_write",
      ],
    });
  }

  assertConfirmedCandidateAllowed({
    candidate = {},
    existing = [],
    metadata = {},
  } = {}) {
    const c = _safeObj(candidate);
    const meta = _safeObj(metadata);
    const existingItems = _safeArr(existing).map((item) => _safeObj(item));
    const errors = [];
    const warnings = [];

    const key = _normalizeKey(c.key || c.memoryKey || meta.key || meta.memoryKey);
    const value = _safeStr(c.value || c.content || c.summary || meta.value).trim();
    const normalizedValue = _normalizeText(value);
    const explicitIntent =
      c.explicit === true ||
      meta.explicit === true ||
      _safeStr(c.intent || meta.intent).trim() === "remember" ||
      _safeStr(c.memoryType || meta.memoryType).trim() === "long_term";

    const memoryLayer = _safeStr(c.memoryLayer || meta.memoryLayer).trim();
    const archiveKind = _safeStr(c.archiveKind || meta.archiveKind).trim();
    const digestKind = _safeStr(c.digestKind || meta.digestKind).trim();

    if (!key) errors.push("missing_confirmed_memory_key");
    if (!value) errors.push("missing_confirmed_memory_value");
    if (!explicitIntent) errors.push("missing_explicit_confirmed_memory_intent");

    if (memoryLayer === "raw_dialogue_archive" || archiveKind === "raw_dialogue") {
      errors.push("archive_candidate_cannot_be_confirmed_memory");
    }

    if (memoryLayer === "topic_digest" || digestKind === "topic_summary") {
      errors.push("digest_candidate_cannot_be_confirmed_memory");
    }

    if (meta.allowSilentOverwrite === true || c.allowSilentOverwrite === true) {
      errors.push("silent_overwrite_forbidden");
    }

    const sameKeyItems = existingItems.filter((item) => {
      const itemKey = _normalizeKey(item.key || item.memoryKey || item?.metadata?.key || item?.metadata?.memoryKey);
      return key && itemKey === key;
    });

    const duplicateItems = sameKeyItems.filter((item) => {
      const itemValue = _normalizeText(item.value || item.content || item.summary || item?.metadata?.value);
      return normalizedValue && itemValue === normalizedValue;
    });

    const conflictItems = sameKeyItems.filter((item) => {
      const itemValue = _normalizeText(item.value || item.content || item.summary || item?.metadata?.value);
      return normalizedValue && itemValue && itemValue !== normalizedValue;
    });

    if (duplicateItems.length > 0) {
      warnings.push("duplicate_confirmed_memory_candidate");
    }

    if (conflictItems.length > 0) {
      errors.push("conflicting_confirmed_memory_candidate");
    }

    return this._baseResult({
      ok: errors.length === 0,
      errors: [...new Set(errors)],
      warnings: [...new Set(warnings)],
      candidate: {
        key,
        hasValue: !!value,
        explicitIntent,
        memoryLayer: memoryLayer || null,
      },
      matches: {
        sameKey: sameKeyItems.length,
        duplicates: duplicateItems.length,
        conflicts: conflictItems.length,
      },
      decision:
        errors.length > 0
          ? "BLOCK_MANUAL_REVIEW"
          : duplicateItems.length > 0
            ? "NOOP_DUPLICATE"
            : "ALLOW_CANDIDATE",
    });
  }

  status() {
    return this._baseResult({
      methods: ["getPolicy", "assertConfirmedCandidateAllowed", "status"],
      defaults: MEMORY_CONFIRMED_GUARD_DEFAULTS,
      reason: "confirmed_memory_guard_active_read_only",
    });
  }
}

export default MemoryConfirmedGuard;
