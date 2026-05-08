// src/memory/project/projectMemoryService.js
// SG 2.0 — Project Memory Service Skeleton
//
// Purpose:
// - Provide read-only / prepare-only project memory helpers.
// - This skeleton does not read DB, write DB, fetch sources, call AI, touch transport, or modify repository state.
// - Runtime integration must happen later after contracts and policies are approved.

import {
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  createProjectMemoryItem,
} from "./projectMemoryTypes.js";

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => safeString(tag).trim())
    .filter(Boolean);
}

export class ProjectMemoryService {
  constructor({ logger = null } = {}) {
    this.logger = logger || console;
  }

  status() {
    return {
      ok: true,
      enabled: true,
      mode: "read_only_prepare_only_skeleton",
      hasDb: false,
      hasRuntimeConnection: false,
      canReadStorage: false,
      canWriteStorage: false,
      canFetchSources: false,
      canCallAI: false,
    };
  }

  buildCandidate({
    type,
    title,
    content,
    scope,
    sourceType = PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    sourceRef = null,
    tags = [],
    metadata = {},
  } = {}) {
    const safeTitle = safeString(title).trim();
    const safeContent = safeString(content).trim();
    const warnings = [];

    if (!safeTitle) {
      warnings.push({
        code: "missing_title",
        message: "Project memory candidate has no title.",
      });
    }

    if (!safeContent) {
      warnings.push({
        code: "missing_content",
        message: "Project memory candidate has no content.",
      });
    }

    const item = createProjectMemoryItem({
      type,
      title: safeTitle,
      content: safeContent,
      scope,
      trust: PROJECT_MEMORY_TRUST.CANDIDATE,
      sourceType,
      sourceRef,
      tags: normalizeTags(tags),
      metadata: {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        skeleton: true,
        preparedBy: "ProjectMemoryService.buildCandidate",
      },
    });

    return {
      ok: warnings.length === 0,
      mode: "prepare_only",
      item,
      warnings,
    };
  }

  normalizeProvidedItems(items = []) {
    if (!Array.isArray(items)) {
      return {
        ok: false,
        items: [],
        warnings: [
          {
            code: "invalid_items_input",
            message: "Project memory items input must be an array.",
          },
        ],
      };
    }

    const warnings = [];
    const normalized = items.map((item, index) => {
      const candidate = createProjectMemoryItem({
        ...item,
        tags: normalizeTags(item?.tags || []),
        metadata: {
          ...(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}),
          normalizedBy: "ProjectMemoryService.normalizeProvidedItems",
        },
      });

      if (!candidate.content) {
        warnings.push({
          code: "empty_project_memory_content",
          message: "Project memory item has empty content.",
          index,
        });
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

  selectForContext({ items = [], limit = 10 } = {}) {
    const normalized = this.normalizeProvidedItems(items);
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.min(50, Number(limit)))
      : 10;

    return {
      ok: normalized.ok,
      mode: "provided_items_only",
      items: normalized.items.slice(0, safeLimit),
      warnings: normalized.warnings,
      limits: {
        requested: limit,
        applied: safeLimit,
      },
    };
  }
}

export default ProjectMemoryService;
