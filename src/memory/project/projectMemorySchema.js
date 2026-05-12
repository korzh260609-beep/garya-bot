// src/memory/project/projectMemorySchema.js
// SG 2.0 — Project Memory durable schema boundary.
// Purpose: define and ensure SG Project Memory storage tables.
// Do not add Telegram logic, AI calls, source sync, automatic chat extraction, or transport handling here.

import { queryPostgres } from "../../db/postgresClient.js";

export const PROJECT_MEMORY_SCHEMA_VERSION = 1;

export const PROJECT_MEMORY_TABLES = Object.freeze({
  ENTRIES: "sg_project_memory_entries",
  WRITE_AUDIT: "sg_project_memory_write_audit",
});

let schemaReadyPromise = null;

function normalizeQueryFn(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

async function run(queryFn, sql, params = []) {
  return normalizeQueryFn(queryFn)(sql, params);
}

export function getProjectMemorySchemaSql() {
  return [
    `CREATE TABLE IF NOT EXISTS sg_project_memory_entries (
      id TEXT PRIMARY KEY,
      project_key TEXT NOT NULL DEFAULT 'sg',
      item_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      scope TEXT NOT NULL,
      trust TEXT NOT NULL DEFAULT 'candidate',
      status TEXT NOT NULL DEFAULT 'active',
      source_type TEXT,
      source_ref TEXT,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      confirmed_by TEXT,
      confirmed_at TIMESTAMPTZ,
      supersedes_id TEXT,
      trace_id TEXT,
      CONSTRAINT sg_project_memory_entries_trust_check CHECK (trust IN ('confirmed', 'candidate', 'deprecated', 'needs_review')),
      CONSTRAINT sg_project_memory_entries_status_check CHECK (status IN ('active', 'superseded', 'archived', 'pending_confirmation', 'rejected', 'stale', 'conflicted'))
    )`,
    `CREATE INDEX IF NOT EXISTS sg_project_memory_entries_project_status_idx
      ON sg_project_memory_entries (project_key, status, trust, item_type)`,
    `CREATE INDEX IF NOT EXISTS sg_project_memory_entries_scope_idx
      ON sg_project_memory_entries (scope, item_type)`,
    `CREATE INDEX IF NOT EXISTS sg_project_memory_entries_source_idx
      ON sg_project_memory_entries (source_type, source_ref)`,
    `CREATE TABLE IF NOT EXISTS sg_project_memory_write_audit (
      trace_id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entry_id TEXT,
      decision TEXT NOT NULL,
      reason TEXT,
      actor_ref TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )`,
    `CREATE INDEX IF NOT EXISTS sg_project_memory_write_audit_entry_idx
      ON sg_project_memory_write_audit (entry_id, created_at DESC)`,
  ];
}

export async function createProjectMemorySchema({ queryFn } = {}) {
  for (const sql of getProjectMemorySchemaSql()) {
    const result = await run(queryFn, sql);
    if (!result.ok) return result;
  }

  return {
    ok: true,
    type: "project_memory_schema_ready",
    schemaVersion: PROJECT_MEMORY_SCHEMA_VERSION,
    tables: PROJECT_MEMORY_TABLES,
  };
}

export async function ensureProjectMemorySchema({ queryFn, force = false } = {}) {
  if (force || queryFn) {
    return createProjectMemorySchema({ queryFn });
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = createProjectMemorySchema({ queryFn });
  }

  const result = await schemaReadyPromise;

  if (!result.ok) {
    schemaReadyPromise = null;
  }

  return result;
}

export default {
  PROJECT_MEMORY_SCHEMA_VERSION,
  PROJECT_MEMORY_TABLES,
  getProjectMemorySchemaSql,
  createProjectMemorySchema,
  ensureProjectMemorySchema,
};
