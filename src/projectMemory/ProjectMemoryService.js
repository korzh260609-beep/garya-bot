// src/projectMemory/ProjectMemoryService.js
// ============================================================================
// Project Memory V2 service
// Purpose:
// - single access layer for project memory
// - preserve backward compatibility with old section-based API
// - add structured fields for universal multi-transport project memory
// ============================================================================

import pool from "../../db.js";
import {
  buildNormalizedProjectMemoryInput,
  normalizeText,
  normalizeStringArray,
} from "./projectMemorySchema.js";
import {
  buildSessionSummaryContent,
  isStructuredSessionSummaryInput,
} from "./sessionSummaryContent.js";
import {
  getProjectMemoryScopeSignature,
  normalizeProjectMemoryMeta,
} from "./projectMemoryScopes.js";
import { annotateConfirmedScopePolicyMeta } from "./projectMemoryConfirmedScopePolicy.js";

export const DEFAULT_PROJECT_KEY = "garya_ai";

const CONFIRMED_ENTRY_TYPES = new Set([
  "section_state",
  "decision",
  "constraint",
  "next_step",
]);

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function extractSessionSummaryBlockLines(content = "", blockName = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const target = String(blockName ?? "").trim().toUpperCase() + ":";

  let inBlock = false;
  const out = [];

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const trimmed = line.trim();

    if (!inBlock) {
      if (trimmed.toUpperCase() === target) {
        inBlock = true;
      }
      continue;
    }

    if (!trimmed) continue;

    if (/^[A-Z_ ]+:$/.test(trimmed)) {
      break;
    }

    const cleaned = trimmed.replace(/^[-*•]\s*/, "").trim();
    if (cleaned) out.push(cleaned);
  }

  return out;
}

function parseSessionSummaryContent(content = "") {
  const goalItems = extractSessionSummaryBlockLines(content, "GOAL");

  return {
    goal: goalItems[0] || "",
    checked: extractSessionSummaryBlockLines(content, "CHECKED"),
    changed: extractSessionSummaryBlockLines(content, "CHANGED"),
    decisions: extractSessionSummaryBlockLines(content, "DECISIONS"),
    risks: extractSessionSummaryBlockLines(content, "RISKS"),
    nextSteps: extractSessionSummaryBlockLines(content, "NEXT"),
    notes: extractSessionSummaryBlockLines(content, "NOTES"),
  };
}

function isConfirmedScopedSectionState(normalized = {}) {
  if (normalizeText(normalized.entryType) !== "section_state") {
    return false;
  }

  const signature = getProjectMemoryScopeSignature(normalized.meta);
  return (
    !!signature.projectArea ||
    !!signature.repoScope ||
    signature.linkedAreas.length > 0 ||
    signature.linkedRepoScopes.length > 0 ||
    signature.crossRepo === true
  );
}

function buildScopedSectionStateLookup({
  projectKey,
  section,
  entryType,
  scopeSignature,
}) {
  const where = [
    "project_key = $1",
    "section = $2",
    "entry_type = $3",
    "is_active = true",
    "COALESCE(meta->>'projectArea', '') = $4",
    "COALESCE(meta->>'repoScope', '') = $5",
    "COALESCE(meta->'linkedAreas', '[]'::jsonb) = $6::jsonb",
    "COALESCE(meta->'linkedRepoScopes', '[]'::jsonb) = $7::jsonb",
    "COALESCE((meta->>'crossRepo')::boolean, false) = $8",
  ];

  const params = [
    projectKey,
    section,
    entryType,
    scopeSignature.projectArea || "",
    scopeSignature.repoScope || "",
    JSON.stringify(scopeSignature.linkedAreas || []),
    JSON.stringify(scopeSignature.linkedRepoScopes || []),
    scopeSignature.crossRepo === true,
  ];

  return {
    sql: `
      SELECT id
      FROM project_memory
      WHERE ${where.join(" AND ")}
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1
    `,
    params,
  };
}

function annotateConfirmedEntryMetaForUpdate({
  entryType,
  section,
  meta,
} = {}) {
  return annotateConfirmedScopePolicyMeta({
    entryType,
    section,
    meta,
    warn: true,
    warningPrefix: "⚠️ ProjectMemoryService soft scope warning on confirmed update",
  });
}

export class ProjectMemoryService {
  constructor({ dbPool = pool, defaultProjectKey = DEFAULT_PROJECT_KEY } = {}) {
    this.pool = dbPool;
    this.defaultProjectKey = defaultProjectKey;
  }

  resolveProjectKey(projectKey) {
    return normalizeText(projectKey) || this.defaultProjectKey;
  }

  async getLatestSection(projectKey = this.defaultProjectKey, section) {
    const resolvedProjectKey = this.resolveProjectKey(projectKey);
    const resolvedSection = normalizeText(section);

    if (!resolvedSection) {
      throw new Error("ProjectMemoryService.getLatestSection: section is required");
    }

    const res = await this.pool.query(
      `
        SELECT
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
        FROM project_memory
        WHERE project_key = $1
          AND section = $2
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      [resolvedProjectKey, resolvedSection]
    );

    return res.rows?.[0] || null;
  }

  async listEntries(projectKey = this.defaultProjectKey, filters = {}) {
    const resolvedProjectKey = this.resolveProjectKey(projectKey);

    const where = [`project_key = $1`];
    const params = [resolvedProjectKey];

    let idx = params.length + 1;

    if (filters.section) {
      where.push(`section = $${idx++}`);
      params.push(normalizeText(filters.section));
    }

    if (filters.entryType) {
      where.push(`entry_type = $${idx++}`);
      params.push(normalizeText(filters.entryType));
    }

    if (filters.status) {
      where.push(`status = $${idx++}`);
      params.push(normalizeText(filters.status));
    }

    if (filters.moduleKey) {
      where.push(`module_key = $${idx++}`);
      params.push(normalizeText(filters.moduleKey));
    }

    if (filters.stageKey) {
      where.push(`stage_key = $${idx++}`);
      params.push(normalizeText(filters.stageKey));
    }

    if (typeof filters.isActive === "boolean") {
      where.push(`is_active = $${idx++}`);
      params.push(filters.isActive);
    }

    const limit =
      Number.isInteger(filters.limit) && filters.limit > 0
        ? Math.min(filters.limit, 500)
        : 200;

    params.push(limit);

    const res = await this.pool.query(
      `
        SELECT
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
        FROM project_memory
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT $${params.length}
      `,
      params
    );

    return res.rows || [];
  }

  async listSections(projectKey = this.defaultProjectKey, section = null) {
    const rows = await this.listEntries(projectKey, {
      section: section || null,
      limit: 500,
    });

    return rows;
  }

  async appendEntry(input = {}) {
    const normalized = buildNormalizedProjectMemoryInput({
      ...input,
      projectKey: this.resolveProjectKey(input.projectKey),
    });

    if (!normalized.section) {
      throw new Error("ProjectMemoryService.appendEntry: section is required");
    }

    if (!normalized.content) {
      throw new Error("ProjectMemoryService.appendEntry: content is required");
    }

    const res = await this.pool.query(
      `
        INSERT INTO project_memory (
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          NOW(), NOW(),
          $8, $9, $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
      `,
      [
        normalized.projectKey,
        normalized.section,
        normalized.title,
        normalized.content,
        normalized.tags,
        normalized.meta,
        normalized.schemaVersion,
        normalized.entryType,
        normalized.status,
        normalized.sourceType,
        normalized.sourceRef,
        normalized.relatedPaths,
        normalized.moduleKey,
        normalized.stageKey,
        normalized.confidence,
        normalized.isActive,
      ]
    );

    return res.rows?.[0] || null;
  }

  async upsertSectionState(input = {}) {
    const normalized = buildNormalizedProjectMemoryInput({
      ...input,
      projectKey: this.resolveProjectKey(input.projectKey),
      entryType: input.entryType || "section_state",
      status: input.status || "active",
      isActive: input.isActive ?? true,
    });

    if (!normalized.section) {
      throw new Error("ProjectMemoryService.upsertSectionState: section is required");
    }

    if (!normalized.content) {
      throw new Error("ProjectMemoryService.upsertSectionState: content is required");
    }

    let existingRes;

    if (isConfirmedScopedSectionState(normalized)) {
      const scopeSignature = getProjectMemoryScopeSignature(normalized.meta);
      const scopedLookup = buildScopedSectionStateLookup({
        projectKey: normalized.projectKey,
        section: normalized.section,
        entryType: normalized.entryType,
        scopeSignature,
      });

      existingRes = await this.pool.query(scopedLookup.sql, scopedLookup.params);
    } else {
      existingRes = await this.pool.query(
        `
          SELECT id
          FROM project_memory
          WHERE project_key = $1
            AND section = $2
            AND entry_type = $3
            AND is_active = true
          ORDER BY updated_at DESC NULLS LAST, id DESC
          LIMIT 1
        `,
        [normalized.projectKey, normalized.section, normalized.entryType]
      );
    }

    if (!existingRes.rows?.length) {
      return this.appendEntry(normalized);
    }

    const id = existingRes.rows[0].id;

    const res = await this.pool.query(
      `
        UPDATE project_memory
        SET
          title = $1,
          content = $2,
          tags = $3,
          meta = $4,
          schema_version = $5,
          updated_at = NOW(),
          status = $6,
          source_type = $7,
          source_ref = $8,
          related_paths = $9,
          module_key = $10,
          stage_key = $11,
          confidence = $12,
          is_active = $13
        WHERE id = $14
        RETURNING
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
      `,
      [
        normalized.title,
        normalized.content,
        normalized.tags,
        normalized.meta,
        normalized.schemaVersion,
        normalized.status,
        normalized.sourceType,
        normalized.sourceRef,
        normalized.relatedPaths,
        normalized.moduleKey,
        normalized.stageKey,
        normalized.confidence,
        normalized.isActive,
        id,
      ]
    );

    return res.rows?.[0] || null;
  }

  async archiveActiveEntries({
    projectKey = this.defaultProjectKey,
    section,
    entryType = null,
  } = {}) {
    const resolvedProjectKey = this.resolveProjectKey(projectKey);
    const resolvedSection = normalizeText(section);

    if (!resolvedSection) {
      throw new Error("ProjectMemoryService.archiveActiveEntries: section is required");
    }

    const params = [resolvedProjectKey, resolvedSection];
    const where = [`project_key = $1`, `section = $2`, `is_active = true`];

    if (entryType) {
      params.push(normalizeText(entryType));
      where.push(`entry_type = $${params.length}`);
    }

    const res = await this.pool.query(
      `
        UPDATE project_memory
        SET
          is_active = false,
          status = 'archived',
          updated_at = NOW()
        WHERE ${where.join(" AND ")}
      `,
      params
    );

    return res.rowCount || 0;
  }

  buildSessionSummaryContentFromInput(input = {}) {
    const explicitContent = normalizeText(input.content);

    if (explicitContent) {
      return explicitContent;
    }

    if (!isStructuredSessionSummaryInput(input)) {
      return "";
    }

    return buildSessionSummaryContent({
      goal: input.goal,
      checked: input.checked,
      changed: input.changed,
      decisions: input.decisions,
      risks: input.risks,
      nextSteps: input.nextSteps,
      notes: input.notes,
    });
  }

  async appendSessionSummary({
    projectKey = this.defaultProjectKey,
    section = "work_sessions",
    title = null,
    content,
    goal = "",
    checked = [],
    changed = [],
    decisions = [],
    risks = [],
    nextSteps = [],
    notes = [],
    tags = [],
    meta = {},
    sourceType = "chat_session",
    sourceRef = null,
    relatedPaths = [],
    moduleKey = null,
    stageKey = null,
    confidence = 0.8,
  } = {}) {
    const resolvedContent = this.buildSessionSummaryContentFromInput({
      content,
      goal,
      checked,
      changed,
      decisions,
      risks,
      nextSteps,
      notes,
    });

    return this.appendEntry({
      projectKey,
      section,
      title,
      content: resolvedContent,
      tags,
      meta,
      schemaVersion: 2,
      entryType: "session_summary",
      status: "active",
      sourceType,
      sourceRef,
      relatedPaths: normalizeStringArray(relatedPaths),
      moduleKey,
      stageKey,
      confidence,
      isActive: true,
    });
  }

  async updateConfirmedEntryById({
    id,
    projectKey = this.defaultProjectKey,
    patch = {},
  } = {}) {
    const resolvedId = Number(id);
    const resolvedProjectKey = this.resolveProjectKey(projectKey);

    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      throw new Error("ProjectMemoryService.updateConfirmedEntryById: valid id is required");
    }

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("ProjectMemoryService.updateConfirmedEntryById: patch object is required");
    }

    const existingRes = await this.pool.query(
      `
        SELECT
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
        FROM project_memory
        WHERE id = $1
          AND project_key = $2
        LIMIT 1
      `,
      [resolvedId, resolvedProjectKey]
    );

    const existing = existingRes.rows?.[0] || null;

    if (!existing) {
      throw new Error(
        `ProjectMemoryService.updateConfirmedEntryById: entry id=${resolvedId} not found`
      );
    }

    if (!CONFIRMED_ENTRY_TYPES.has(normalizeText(existing.entry_type))) {
      throw new Error(
        "ProjectMemoryService.updateConfirmedEntryById: entry is not a confirmed-memory type"
      );
    }

    const nextMetaBase = {
      ...normalizeMeta(existing.meta),
      ...(
        Object.prototype.hasOwnProperty.call(patch, "meta")
          ? normalizeMeta(patch.meta)
          : {}
      ),
    };

    if (Object.prototype.hasOwnProperty.call(patch, "aiContext")) {
      nextMetaBase.aiContext = patch.aiContext;
    }

    const nextMeta = normalizeProjectMemoryMeta(
      nextMetaBase,
      {
        projectArea: Object.prototype.hasOwnProperty.call(patch, "projectArea")
          ? patch.projectArea
          : nextMetaBase.projectArea,
        repoScope: Object.prototype.hasOwnProperty.call(patch, "repoScope")
          ? patch.repoScope
          : nextMetaBase.repoScope,
        linkedAreas: Object.prototype.hasOwnProperty.call(patch, "linkedAreas")
          ? patch.linkedAreas
          : nextMetaBase.linkedAreas,
        linkedRepoScopes: Object.prototype.hasOwnProperty.call(patch, "linkedRepoScopes")
          ? patch.linkedRepoScopes
          : nextMetaBase.linkedRepoScopes,
        crossRepo: Object.prototype.hasOwnProperty.call(patch, "crossRepo")
          ? patch.crossRepo
          : nextMetaBase.crossRepo,
      },
      {
        defaultProjectArea: null,
        defaultRepoScope: null,
        defaultCrossRepo: false,
      }
    );

    const nextMetaWithDiagnostics = annotateConfirmedEntryMetaForUpdate({
      entryType: existing.entry_type,
      section: existing.section,
      meta: nextMeta,
    });

    const normalized = buildNormalizedProjectMemoryInput({
      projectKey: existing.project_key,
      section: existing.section,
      title:
        Object.prototype.hasOwnProperty.call(patch, "title")
          ? patch.title
          : existing.title,
      content:
        Object.prototype.hasOwnProperty.call(patch, "content")
          ? patch.content
          : existing.content,
      tags:
        Object.prototype.hasOwnProperty.call(patch, "tags")
          ? patch.tags
          : existing.tags,
      meta: nextMetaWithDiagnostics,
      schemaVersion: existing.schema_version,
      entryType: existing.entry_type,
      status:
        Object.prototype.hasOwnProperty.call(patch, "status")
          ? patch.status
          : existing.status,
      sourceType:
        Object.prototype.hasOwnProperty.call(patch, "sourceType")
          ? patch.sourceType
          : existing.source_type,
      sourceRef:
        Object.prototype.hasOwnProperty.call(patch, "sourceRef")
          ? patch.sourceRef
          : existing.source_ref,
      relatedPaths:
        Object.prototype.hasOwnProperty.call(patch, "relatedPaths")
          ? patch.relatedPaths
          : existing.related_paths,
      moduleKey:
        Object.prototype.hasOwnProperty.call(patch, "moduleKey")
          ? patch.moduleKey
          : existing.module_key,
      stageKey:
        Object.prototype.hasOwnProperty.call(patch, "stageKey")
          ? patch.stageKey
          : existing.stage_key,
      confidence:
        Object.prototype.hasOwnProperty.call(patch, "confidence")
          ? patch.confidence
          : existing.confidence,
      isActive:
        Object.prototype.hasOwnProperty.call(patch, "isActive")
          ? patch.isActive
          : existing.is_active,
    });

    const res = await this.pool.query(
      `
        UPDATE project_memory
        SET
          title = $1,
          content = $2,
          tags = $3,
          meta = $4,
          schema_version = $5,
          updated_at = NOW(),
          status = $6,
          source_type = $7,
          source_ref = $8,
          related_paths = $9,
          module_key = $10,
          stage_key = $11,
          confidence = $12,
          is_active = $13
        WHERE id = $14
          AND project_key = $15
        RETURNING
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
      `,
      [
        normalized.title,
        normalized.content,
        normalized.tags,
        normalized.meta,
        normalized.schemaVersion,
        normalized.status,
        normalized.sourceType,
        normalized.sourceRef,
        normalized.relatedPaths,
        normalized.moduleKey,
        normalized.stageKey,
        normalized.confidence,
        normalized.isActive,
        resolvedId,
        resolvedProjectKey,
      ]
    );

    return res.rows?.[0] || null;
  }

  async updateSessionSummaryById({
    id,
    projectKey = this.defaultProjectKey,
    section = "work_sessions",
    patch = {},
  } = {}) {
    const resolvedId = Number(id);
    const resolvedProjectKey = this.resolveProjectKey(projectKey);
    const resolvedSection = normalizeText(section) || "work_sessions";

    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      throw new Error("ProjectMemoryService.updateSessionSummaryById: valid id is required");
    }

    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("ProjectMemoryService.updateSessionSummaryById: patch object is required");
    }

    const existingRes = await this.pool.query(
      `
        SELECT
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
        FROM project_memory
        WHERE id = $1
          AND project_key = $2
          AND section = $3
          AND entry_type = 'session_summary'
        LIMIT 1
      `,
      [resolvedId, resolvedProjectKey, resolvedSection]
    );

    const existing = existingRes.rows?.[0] || null;

    if (!existing) {
      throw new Error(
        `ProjectMemoryService.updateSessionSummaryById: session_summary id=${resolvedId} not found`
      );
    }

    const hasStructuredPatch =
      Object.prototype.hasOwnProperty.call(patch, "goal") ||
      Object.prototype.hasOwnProperty.call(patch, "checked") ||
      Object.prototype.hasOwnProperty.call(patch, "changed") ||
      Object.prototype.hasOwnProperty.call(patch, "decisions") ||
      Object.prototype.hasOwnProperty.call(patch, "risks") ||
      Object.prototype.hasOwnProperty.call(patch, "nextSteps") ||
      Object.prototype.hasOwnProperty.call(patch, "notes");

    let resolvedContent = normalizeText(
      Object.prototype.hasOwnProperty.call(patch, "content")
        ? patch.content
        : existing.content
    );

    if (hasStructuredPatch) {
      const previousStructured = parseSessionSummaryContent(existing.content);

      resolvedContent = this.buildSessionSummaryContentFromInput({
        goal: Object.prototype.hasOwnProperty.call(patch, "goal")
          ? patch.goal
          : previousStructured.goal,
        checked: Object.prototype.hasOwnProperty.call(patch, "checked")
          ? patch.checked
          : previousStructured.checked,
        changed: Object.prototype.hasOwnProperty.call(patch, "changed")
          ? patch.changed
          : previousStructured.changed,
        decisions: Object.prototype.hasOwnProperty.call(patch, "decisions")
          ? patch.decisions
          : previousStructured.decisions,
        risks: Object.prototype.hasOwnProperty.call(patch, "risks")
          ? patch.risks
          : previousStructured.risks,
        nextSteps: Object.prototype.hasOwnProperty.call(patch, "nextSteps")
          ? patch.nextSteps
          : previousStructured.nextSteps,
        notes: Object.prototype.hasOwnProperty.call(patch, "notes")
          ? patch.notes
          : previousStructured.notes,
      });
    }

    if (!resolvedContent) {
      throw new Error(
        "ProjectMemoryService.updateSessionSummaryById: content cannot be empty for session_summary"
      );
    }

    const normalized = buildNormalizedProjectMemoryInput({
      projectKey: existing.project_key,
      section: existing.section,
      title:
        Object.prototype.hasOwnProperty.call(patch, "title")
          ? patch.title
          : existing.title,
      content: resolvedContent,
      tags:
        Object.prototype.hasOwnProperty.call(patch, "tags")
          ? patch.tags
          : existing.tags,
      meta:
        Object.prototype.hasOwnProperty.call(patch, "meta")
          ? patch.meta
          : existing.meta,
      schemaVersion: existing.schema_version,
      entryType: existing.entry_type,
      status:
        Object.prototype.hasOwnProperty.call(patch, "status")
          ? patch.status
          : existing.status,
      sourceType:
        Object.prototype.hasOwnProperty.call(patch, "sourceType")
          ? patch.sourceType
          : existing.source_type,
      sourceRef:
        Object.prototype.hasOwnProperty.call(patch, "sourceRef")
          ? patch.sourceRef
          : existing.source_ref,
      relatedPaths:
        Object.prototype.hasOwnProperty.call(patch, "relatedPaths")
          ? patch.relatedPaths
          : existing.related_paths,
      moduleKey:
        Object.prototype.hasOwnProperty.call(patch, "moduleKey")
          ? patch.moduleKey
          : existing.module_key,
      stageKey:
        Object.prototype.hasOwnProperty.call(patch, "stageKey")
          ? patch.stageKey
          : existing.stage_key,
      confidence:
        Object.prototype.hasOwnProperty.call(patch, "confidence")
          ? patch.confidence
          : existing.confidence,
      isActive:
        Object.prototype.hasOwnProperty.call(patch, "isActive")
          ? patch.isActive
          : existing.is_active,
    });

    const res = await this.pool.query(
      `
        UPDATE project_memory
        SET
          title = $1,
          content = $2,
          tags = $3,
          meta = $4,
          schema_version = $5,
          updated_at = NOW(),
          status = $6,
          source_type = $7,
          source_ref = $8,
          related_paths = $9,
          module_key = $10,
          stage_key = $11,
          confidence = $12,
          is_active = $13
        WHERE id = $14
          AND project_key = $15
          AND section = $16
          AND entry_type = 'session_summary'
        RETURNING
          id,
          project_key,
          section,
          title,
          content,
          tags,
          meta,
          schema_version,
          created_at,
          updated_at,
          entry_type,
          status,
          source_type,
          source_ref,
          related_paths,
          module_key,
          stage_key,
          confidence,
          is_active
      `,
      [
        normalized.title,
        normalized.content,
        normalized.tags,
        normalized.meta,
        normalized.schemaVersion,
        normalized.status,
        normalized.sourceType,
        normalized.sourceRef,
        normalized.relatedPaths,
        normalized.moduleKey,
        normalized.stageKey,
        normalized.confidence,
        normalized.isActive,
        resolvedId,
        resolvedProjectKey,
        resolvedSection,
      ]
    );

    return res.rows?.[0] || null;
  }
}

export default ProjectMemoryService;
