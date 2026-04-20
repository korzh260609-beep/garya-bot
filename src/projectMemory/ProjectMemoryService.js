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

export const DEFAULT_PROJECT_KEY = "garya_ai";

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

    const existingRes = await this.pool.query(
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

  async appendSessionSummary({
    projectKey = this.defaultProjectKey,
    section = "work_sessions",
    title = null,
    content,
    tags = [],
    meta = {},
    sourceType = "chat_session",
    sourceRef = null,
    relatedPaths = [],
    moduleKey = null,
    stageKey = null,
    confidence = 0.8,
  } = {}) {
    return this.appendEntry({
      projectKey,
      section,
      title,
      content,
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
}

export default ProjectMemoryService;