// AGENT NOTE:
// SG 2.0 Project Memory core migration definition.
// Purpose: describe the first Project Memory storage migration as a reviewable plan-only definition.
// This file must not execute queries, mutate DB state, write Project Memory, call AI, touch Telegram, or run at startup.

export const PROJECT_MEMORY_CORE_MIGRATION_ID = "001_project_memory_core";

export const projectMemoryCoreMigration = Object.freeze({
  id: PROJECT_MEMORY_CORE_MIGRATION_ID,
  name: "project_memory_core",
  module: "project_memory",
  upSql: Object.freeze([
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
  ]),
});

export default projectMemoryCoreMigration;
