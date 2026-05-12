// src/projects/userProjectsStore.js
// SG 2.0 — User Projects Registry store.
//
// Purpose:
// - Create and read user-owned project records.
// - Keep durable project registry separate from Project Memory storage.
//
// Hard rules:
// - Do not write Project Memory here.
// - Do not confirm Project Memory candidates here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not infer project ownership from natural-language phrases.

import { queryPostgres } from "../db/postgresClient.js";
import { buildUserProjectMemoryKey } from "../memory/project/projectMemoryOwnership.js";
import { ensureUserProjectsSchema } from "./userProjectsSchema.js";
import {
  USER_PROJECTS_REGISTRY_VERSION,
  createUserProjectRecord,
  validateUserProjectRecord,
  normalizeUserProjectKeyPart,
  normalizeUserProjectText,
} from "./userProjectsTypes.js";

function normalizeQueryFn(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

function safeJson(value, fallback) {
  if (value === null || value === undefined) return JSON.stringify(fallback);
  return JSON.stringify(value);
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapRowToUserProject(row = {}) {
  const record = createUserProjectRecord({
    id: row.id,
    ownerGlobalUserId: row.owner_global_user_id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    visibility: row.visibility,
    metadata: parseJsonValue(row.metadata, {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  });

  const memoryKey = buildUserProjectMemoryKey({
    globalUserId: record.ownerGlobalUserId,
    userProjectId: record.id,
  });

  return {
    ...record,
    projectMemoryKey: memoryKey.ok ? memoryKey.projectKey : "",
  };
}

export class UserProjectsStore {
  constructor({ queryFn = null, ensureSchema = true } = {}) {
    this.queryFn = normalizeQueryFn(queryFn);
    this.ensureSchema = ensureSchema;
  }

  status() {
    return {
      ok: true,
      module: "projects",
      service: "user_projects_registry",
      version: USER_PROJECTS_REGISTRY_VERSION,
      hasStorageBoundary: true,
      hasProjectMemoryWrites: false,
      hasProjectMemoryConfirmation: false,
      hasTransportLogic: false,
      hasAICalls: false,
      hasSourceFetching: false,
    };
  }

  getDiagnostics() {
    return {
      ...this.status(),
      boundaries: {
        writesProjectMemory: false,
        confirmsProjectMemory: false,
        callsAI: false,
        touchesTelegram: false,
        fetchesSources: false,
        infersOwnershipFromText: false,
      },
      supportedActions: [
        "ensure_ready",
        "create_project",
        "get_project",
        "list_owner_projects",
      ],
      blockedActions: [
        "project_memory_write",
        "project_memory_confirm",
        "ai_call",
        "telegram_command",
        "source_sync",
        "ownership_inference_from_chat_text",
      ],
    };
  }

  async ensureReady() {
    if (!this.ensureSchema) {
      return { ok: true, skipped: true, reason: "schema_ensure_disabled" };
    }
    return ensureUserProjectsSchema({ queryFn: this.queryFn });
  }

  async createProject(input = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const record = createUserProjectRecord(input);
    const validation = validateUserProjectRecord(record);

    if (!validation.ok) {
      return {
        ok: false,
        reason: "invalid_user_project_record",
        errors: validation.errors,
        project: record,
      };
    }

    const result = await this.queryFn(
      `INSERT INTO sg_user_projects (
        id, owner_global_user_id, title, slug, status, visibility, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (owner_global_user_id, id) DO UPDATE
      SET title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          status = EXCLUDED.status,
          visibility = EXCLUDED.visibility,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      RETURNING *`,
      [
        record.id,
        record.ownerGlobalUserId,
        record.title,
        record.slug,
        record.status,
        record.visibility,
        safeJson(record.metadata, {}),
      ],
    );

    if (!result.ok) return result;

    return {
      ok: true,
      project: mapRowToUserProject(result.rows?.[0] || record),
      createdOrUpdated: true,
    };
  }

  async getProject({ ownerGlobalUserId = "", id = "" } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const owner = normalizeUserProjectKeyPart(ownerGlobalUserId);
    const projectId = normalizeUserProjectKeyPart(id);

    if (!owner || !projectId) {
      return {
        ok: false,
        reason: "missing_owner_global_user_id_or_project_id",
        project: null,
      };
    }

    const result = await this.queryFn(
      `SELECT * FROM sg_user_projects
       WHERE owner_global_user_id = $1 AND id = $2
       LIMIT 1`,
      [owner, projectId],
    );

    if (!result.ok) return result;

    const row = result.rows?.[0];

    return {
      ok: Boolean(row),
      reason: row ? null : "user_project_not_found",
      project: row ? mapRowToUserProject(row) : null,
    };
  }

  async listOwnerProjects({ ownerGlobalUserId = "", status = "", limit = 50 } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const owner = normalizeUserProjectKeyPart(ownerGlobalUserId);
    const safeStatus = normalizeUserProjectText(status).toLowerCase();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));

    if (!owner) {
      return {
        ok: false,
        reason: "missing_owner_global_user_id",
        projects: [],
        rowCount: 0,
      };
    }

    const params = safeStatus ? [owner, safeStatus, safeLimit] : [owner, safeLimit];
    const sql = safeStatus
      ? `SELECT * FROM sg_user_projects
         WHERE owner_global_user_id = $1 AND status = $2
         ORDER BY updated_at DESC, created_at DESC
         LIMIT $3`
      : `SELECT * FROM sg_user_projects
         WHERE owner_global_user_id = $1
         ORDER BY updated_at DESC, created_at DESC
         LIMIT $2`;

    const result = await this.queryFn(sql, params);

    if (!result.ok) return result;

    const projects = (result.rows || []).map(mapRowToUserProject);

    return {
      ok: true,
      projects,
      rowCount: projects.length,
      limit: safeLimit,
    };
  }
}

export default UserProjectsStore;
