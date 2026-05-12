// src/memory/project/projectMemoryStore.js
// SG 2.0 — Project Memory durable store.
// Purpose: provide controlled DB read/write helpers for SG Project Memory.
// Do not add Telegram logic, AI calls, source sync, automatic chat extraction, or transport handling here.

import crypto from "node:crypto";
import { queryPostgres } from "../../db/postgresClient.js";
import { PROJECT_MEMORY_TRUST, createProjectMemoryItem } from "./projectMemoryTypes.js";
import { ensureProjectMemorySchema } from "./projectMemorySchema.js";

function normalizeQueryFn(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
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

function createId(prefix = "pm") {
  return `${prefix}_${crypto.randomUUID()}`;
}

function mapRowToProjectMemoryItem(row = {}) {
  return {
    id: row.id || "",
    projectKey: row.project_key || "sg",
    ...createProjectMemoryItem({
      type: row.item_type,
      title: row.title,
      content: row.content,
      scope: row.scope,
      trust: row.trust,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      tags: parseJsonValue(row.tags, []),
      metadata: parseJsonValue(row.metadata, {}),
    }),
    status: row.status || "active",
    createdBy: row.created_by || "system",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    confirmedBy: row.confirmed_by || "",
    confirmedAt: row.confirmed_at || null,
    supersedesId: row.supersedes_id || "",
    traceId: row.trace_id || "",
  };
}

export class ProjectMemoryStore {
  constructor({ queryFn = null, ensureSchema = true } = {}) {
    this.queryFn = normalizeQueryFn(queryFn);
    this.ensureSchema = ensureSchema;
  }

  async ensureReady() {
    if (!this.ensureSchema) {
      return { ok: true, skipped: true, reason: "schema_ensure_disabled" };
    }
    return ensureProjectMemorySchema({ queryFn: this.queryFn });
  }

  async appendAudit({ traceId = createId("pmtrace"), action, entryId = null, decision, reason = "", actorRef = "system", metadata = {} } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    return this.queryFn(
      `INSERT INTO sg_project_memory_write_audit (trace_id, action, entry_id, decision, reason, actor_ref, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (trace_id) DO NOTHING`,
      [traceId, normalizeText(action), entryId, normalizeText(decision), normalizeText(reason), normalizeText(actorRef) || "system", safeJson(metadata, {})],
    );
  }

  async createCandidate({ item, createdBy = "system", projectKey = "sg", traceId = createId("pmtrace") } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const entryId = createId("pm");
    const tags = Array.isArray(item?.tags) ? item.tags : [];
    const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};

    const result = await this.queryFn(
      `INSERT INTO sg_project_memory_entries (
        id, project_key, item_type, title, content, scope, trust, status, source_type, source_ref,
        tags, metadata, created_by, trace_id
      ) VALUES ($1, $2, $3, $4, $5, $6, 'candidate', 'pending_confirmation', $7, $8, $9::jsonb, $10::jsonb, $11, $12)
      RETURNING *`,
      [
        entryId,
        normalizeText(projectKey) || "sg",
        normalizeText(item?.type),
        normalizeText(item?.title),
        normalizeText(item?.content),
        normalizeText(item?.scope),
        item?.sourceType ? normalizeText(item.sourceType) : null,
        item?.sourceRef ? normalizeText(item.sourceRef) : null,
        safeJson(tags, []),
        safeJson(metadata, {}),
        normalizeText(createdBy) || "system",
        traceId,
      ],
    );

    if (!result.ok) return result;

    await this.appendAudit({
      traceId,
      action: "create_candidate",
      entryId,
      decision: "candidate_created",
      actorRef: createdBy,
      metadata: { projectKey },
    });

    return {
      ok: true,
      entry: mapRowToProjectMemoryItem(result.rows?.[0] || {}),
      traceId,
    };
  }

  async confirmCandidate({ entryId, confirmedBy = "system", traceId = createId("pmtrace") } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const result = await this.queryFn(
      `UPDATE sg_project_memory_entries
       SET trust = 'confirmed', status = 'active', confirmed_by = $2, confirmed_at = NOW(), updated_at = NOW(), trace_id = $3
       WHERE id = $1 AND trust = 'candidate' AND status = 'pending_confirmation'
       RETURNING *`,
      [normalizeText(entryId), normalizeText(confirmedBy) || "system", traceId],
    );

    if (!result.ok) return result;

    if (!result.rowCount) {
      await this.appendAudit({
        traceId,
        action: "confirm_candidate",
        entryId,
        decision: "not_confirmed",
        reason: "candidate_not_found_or_not_pending",
        actorRef: confirmedBy,
      });

      return {
        ok: false,
        reason: "candidate_not_found_or_not_pending",
        entry: null,
        traceId,
      };
    }

    await this.appendAudit({
      traceId,
      action: "confirm_candidate",
      entryId,
      decision: "confirmed",
      actorRef: confirmedBy,
    });

    return {
      ok: true,
      entry: mapRowToProjectMemoryItem(result.rows?.[0] || {}),
      traceId,
    };
  }

  async listEntries({ projectKey = "sg", trust = PROJECT_MEMORY_TRUST.CONFIRMED, status = "active", limit = 20 } = {}) {
    const ready = await this.ensureReady();
    if (!ready.ok) return ready;

    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const result = await this.queryFn(
      `SELECT * FROM sg_project_memory_entries
       WHERE project_key = $1 AND trust = $2 AND status = $3
       ORDER BY updated_at DESC, created_at DESC
       LIMIT $4`,
      [normalizeText(projectKey) || "sg", normalizeText(trust) || PROJECT_MEMORY_TRUST.CONFIRMED, normalizeText(status) || "active", safeLimit],
    );

    if (!result.ok) return result;

    return {
      ok: true,
      entries: (result.rows || []).map(mapRowToProjectMemoryItem),
      rowCount: result.rowCount || 0,
      limit: safeLimit,
    };
  }
}

export default ProjectMemoryStore;
