// src/memory/project/projectMemoryService.js
// SG 2.0 — Project Memory Service V1 Runtime Skeleton
//
// Purpose:
// - Provide read-only / prepare-only SG Project Memory helpers.
// - Build candidates, validate candidates, normalize provided items, select bounded context.
// - This file does not read DB, write DB, fetch sources, call AI, touch transport, or modify repository state.
// - Durable writes, sync, DB storage, and transport integration require separate Monarch approval.

import {
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  createProjectMemoryItem,
} from "./projectMemoryTypes.js";
import { assertProjectMemoryCandidateAllowed } from "../policies/projectMemoryPolicy.js";

export const PROJECT_MEMORY_SERVICE_VERSION = 1;

export const PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS = Object.freeze({
  maxItems: 10,
  maxContentChars: 1200,
  maxTitleChars: 160,
});

const SECRET_NAME_PATTERNS = Object.freeze([
  /(^|_)SECRET$/i,
  /(^|_)TOKEN$/i,
  /(^|_)API_KEY$/i,
  /(^|_)PRIVATE_KEY$/i,
  /(^|_)PASSWORD$/i,
  /(^|_)WEBHOOK_SECRET$/i,
  /(^|_)SIGNING_SECRET$/i,
  /^DATABASE_URL$/i,
  /^OPENAI_API_KEY$/i,
  /^TELEGRAM_BOT_TOKEN$/i,
  /^RENDER_API_KEY$/i,
  /^GITHUB_APP_PRIVATE_KEY$/i,
]);

const SECRET_VALUE_PATTERNS = Object.freeze([
  /sk-[A-Za-z0-9_-]{12,}/,
  /ghp_[A-Za-z0-9_]{12,}/,
  /github_pat_[A-Za-z0-9_]{12,}/,
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /postgres(?:ql)?:\/\/[^\s]+/i,
  /mongodb(?:\+srv)?:\/\/[^\s]+/i,
  /redis:\/\/[^\s]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
]);

const RAW_BLOCKED_SOURCE_TYPES = new Set([
  "raw_log",
  "raw_logs",
  "raw_env",
  "env_dump",
  "provider_raw",
  "transport_raw",
]);

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function clampText(value, maxChars = null) {
  const text = normalizeText(value);
  if (!text) return "";
  const max = Number(maxChars);
  if (!Number.isFinite(max) || max <= 0 || text.length <= max) return text;
  return `${text.slice(0, Math.max(1, Math.trunc(max)) - 1)}…`;
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];

  for (const tag of tags) {
    const normalized = normalizeText(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = normalizeText(value);
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function hasSourceReference(item = {}) {
  return Boolean(normalizeText(item.sourceRef) || normalizeText(item.sourceType));
}

function textContainsSecret(value) {
  const text = safeString(value);
  if (!text) return false;
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

function nameLooksSecret(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_NAME_PATTERNS.some((pattern) => pattern.test(text));
}

function itemContainsSecret(item = {}) {
  if (textContainsSecret(item.title) || textContainsSecret(item.content) || textContainsSecret(item.sourceRef)) {
    return true;
  }

  for (const tag of item.tags || []) {
    if (nameLooksSecret(tag) || textContainsSecret(tag)) return true;
  }

  const metadata = normalizePlainObject(item.metadata);
  for (const [key, value] of Object.entries(metadata)) {
    if (nameLooksSecret(key)) return true;
    if (typeof value === "string" && textContainsSecret(value)) return true;
  }

  return false;
}

function sourceTypeIsBlocked(sourceType) {
  return RAW_BLOCKED_SOURCE_TYPES.has(normalizeText(sourceType).toLowerCase());
}

function buildWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildError(code, message, extra = {}) {
  return { code, message, ...extra };
}

export class ProjectMemoryService {
  constructor({ logger = null } = {}) {
    this.logger = logger || console;
  }

  status() {
    return {
      ok: true,
      enabled: true,
      version: PROJECT_MEMORY_SERVICE_VERSION,
      mode: "read_only_prepare_only_runtime_skeleton",
      hasDb: false,
      hasRuntimeConnection: false,
      canReadStorage: false,
      canWriteStorage: false,
      canFetchSources: false,
      canCallAI: false,
      canBuildCandidates: true,
      canValidateCandidates: true,
      canSelectProvidedContext: true,
      canBuildContextItems: true,
      durableWritesEnabled: false,
      confirmationRequiredForDurableMemory: true,
    };
  }

  getDiagnostics() {
    return {
      ok: true,
      module: "project_memory",
      service: "ProjectMemoryService",
      version: PROJECT_MEMORY_SERVICE_VERSION,
      mode: "runtime_skeleton",
      storage: {
        hasDb: false,
        canReadStorage: false,
        canWriteStorage: false,
      },
      sideEffects: {
        fetchesSources: false,
        callsAI: false,
        touchesTransport: false,
        modifiesRepository: false,
        writesRuntime: false,
      },
      supportedActions: [
        "status",
        "getDiagnostics",
        "buildCandidate",
        "validateCandidate",
        "normalizeProvidedItems",
        "selectForContext",
        "buildContextItems",
      ],
      blockedActions: [
        "db_read",
        "db_write",
        "auto_write_from_chat",
        "ai_auto_write",
        "source_sync",
        "telegram_command",
        "raw_log_storage",
        "secret_storage",
      ],
    };
  }

  buildCandidate(input = {}) {
    const {
      type,
      title,
      content,
      scope,
      sourceRef = null,
      tags = [],
      metadata = {},
    } = input;
    const sourceType = hasOwn(input, "sourceType")
      ? input.sourceType
      : PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL;
    const safeTitle = normalizeText(title);
    const safeContent = normalizeText(content);
    const warnings = [];

    if (!safeTitle) {
      warnings.push(buildWarning("missing_title", "Project memory candidate has no title."));
    }

    if (!safeContent) {
      warnings.push(buildWarning("missing_content", "Project memory candidate has no content."));
    }

    const item = createProjectMemoryItem({
      type: normalizeEnum(type, Object.values(PROJECT_MEMORY_TYPES), PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION),
      title: safeTitle,
      content: safeContent,
      scope: normalizeEnum(scope, Object.values(PROJECT_MEMORY_SCOPES), PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT),
      trust: PROJECT_MEMORY_TRUST.CANDIDATE,
      sourceType: sourceType ? normalizeText(sourceType) : null,
      sourceRef,
      tags: normalizeTags(tags),
      metadata: {
        ...normalizePlainObject(metadata),
        skeleton: true,
        preparedBy: "ProjectMemoryService.buildCandidate",
      },
    });

    const validation = this.validateCandidate(item);

    return {
      ok: warnings.length === 0 && validation.ok,
      mode: "prepare_only",
      item,
      validation,
      warnings: [...warnings, ...validation.warnings],
      errors: validation.errors,
    };
  }

  validateCandidate(item = {}) {
    const normalized = this.normalizeProvidedItems([item]).items[0] || createProjectMemoryItem();
    const errors = [];
    const warnings = [];

    if (!normalized.title) {
      warnings.push(buildWarning("missing_title", "Project memory candidate title is empty."));
    }

    if (!normalized.content) {
      errors.push(buildError("missing_content", "Project memory candidate content is required."));
    }

    if (!hasSourceReference(normalized)) {
      warnings.push(buildWarning("missing_source_reference", "Project memory candidate should have sourceType or sourceRef."));
    }

    if (itemContainsSecret(normalized)) {
      errors.push(buildError("contains_secret", "Project memory candidate appears to contain secret material."));
    }

    if (sourceTypeIsBlocked(normalized.sourceType)) {
      errors.push(buildError("blocked_raw_source_type", "Raw logs/env/provider dumps cannot become Project Memory."));
    }

    const policy = assertProjectMemoryCandidateAllowed({
      hasContent: Boolean(normalized.content),
      hasSource: hasSourceReference(normalized),
      sourceReviewed: normalized.trust === PROJECT_MEMORY_TRUST.CONFIRMED,
      containsSecret: itemContainsSecret(normalized),
      conflictsWithVerifiedSource: normalized.metadata?.conflictsWithVerifiedSource === true,
      monarchApproved: normalized.trust === PROJECT_MEMORY_TRUST.CONFIRMED,
    });

    return {
      ok: errors.length === 0 && policy.ok,
      decision: errors.length === 0 && policy.ok ? "ALLOW_CANDIDATE" : "BLOCK_PROJECT_MEMORY",
      item: normalized,
      errors: [...errors, ...policy.errors.map((code) => buildError(code, `Policy blocked project memory candidate: ${code}`))],
      warnings: [
        ...warnings,
        ...policy.warnings.map((code) => buildWarning(code, `Policy warning for project memory candidate: ${code}`)),
      ],
      requiresApproval: true,
      policy,
    };
  }

  normalizeProvidedItems(items = []) {
    if (!Array.isArray(items)) {
      return {
        ok: false,
        items: [],
        warnings: [
          buildWarning("invalid_items_input", "Project memory items input must be an array."),
        ],
      };
    }

    const warnings = [];
    const normalized = items.map((item, index) => {
      const candidate = createProjectMemoryItem({
        ...item,
        type: normalizeEnum(item?.type, Object.values(PROJECT_MEMORY_TYPES), PROJECT_MEMORY_TYPES.ARCHITECTURE_DECISION),
        title: clampText(item?.title, PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxTitleChars),
        content: normalizeText(item?.content),
        scope: normalizeEnum(item?.scope, Object.values(PROJECT_MEMORY_SCOPES), PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT),
        trust: normalizeEnum(item?.trust, Object.values(PROJECT_MEMORY_TRUST), PROJECT_MEMORY_TRUST.CANDIDATE),
        sourceType: item?.sourceType ? normalizeText(item.sourceType) : null,
        sourceRef: item?.sourceRef ? normalizeText(item.sourceRef) : null,
        tags: normalizeTags(item?.tags || []),
        metadata: {
          ...normalizePlainObject(item?.metadata),
          normalizedBy: "ProjectMemoryService.normalizeProvidedItems",
        },
      });

      if (!candidate.content) {
        warnings.push(buildWarning("empty_project_memory_content", "Project memory item has empty content.", { index }));
      }

      if (itemContainsSecret(candidate)) {
        warnings.push(buildWarning("possible_secret_detected", "Project memory item may contain secret material.", { index }));
      }

      if (sourceTypeIsBlocked(candidate.sourceType)) {
        warnings.push(buildWarning("blocked_raw_source_type", "Project memory item uses blocked raw source type.", { index }));
      }

      return candidate;
    });

    return {
      ok: true,
      mode: "normalize_only",
      items: normalized,
      warnings,
    };
  }

  selectForContext({ items = [], limit = PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxItems, maxContentChars = PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxContentChars } = {}) {
    const normalized = this.normalizeProvidedItems(items);
    const safeLimit = normalizeLimit(limit, PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxItems, 1, 50);
    const safeMaxContentChars = normalizeLimit(maxContentChars, PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxContentChars, 100, 6000);

    const usableItems = [];
    const warnings = [...normalized.warnings];

    for (const item of normalized.items) {
      const validation = this.validateCandidate(item);
      if (!validation.ok) {
        warnings.push(buildWarning("project_memory_item_skipped", "Project memory item skipped because validation failed.", {
          title: item.title,
          errors: validation.errors.map((entry) => entry.code),
        }));
        continue;
      }

      usableItems.push({
        ...item,
        content: clampText(item.content, safeMaxContentChars),
      });
    }

    return {
      ok: normalized.ok,
      mode: "provided_items_only",
      items: usableItems.slice(0, safeLimit),
      warnings,
      limits: {
        requested: limit,
        applied: safeLimit,
        maxContentChars: safeMaxContentChars,
      },
    };
  }

  buildContextItems({ items = [], limit = PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxItems, maxContentChars = PROJECT_MEMORY_CONTEXT_DEFAULT_LIMITS.maxContentChars } = {}) {
    const selected = this.selectForContext({ items, limit, maxContentChars });

    return {
      ok: selected.ok,
      mode: "context_items_from_provided_project_memory",
      items: selected.items.map((item) => ({
        type: "project_memory",
        content: item.content,
        source: item.sourceRef || item.sourceType || "project_memory_candidate",
        priority: "below_verified_sources",
        trust: item.trust,
        scope: item.scope,
        owner: "sg_project",
        metadata: {
          ...item.metadata,
          projectMemoryType: item.type,
          title: item.title,
          tags: item.tags,
          sourceType: item.sourceType,
          sourceRef: item.sourceRef,
        },
      })),
      warnings: selected.warnings,
      limits: selected.limits,
    };
  }
}

export default ProjectMemoryService;
