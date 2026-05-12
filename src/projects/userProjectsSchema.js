// src/projects/userProjectsSchema.js
// SG 2.0 — User Projects Registry schema boundary.
//
// Purpose:
// - Define and ensure durable user project storage.
// - Keep project registry separate from Project Memory, Telegram, AI, billing, and sources.
//
// Hard rules:
// - Do not write Project Memory here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not infer ownership from natural-language phrases.

import { queryPostgres } from "../db/postgresClient.js";

export const USER_PROJECTS_SCHEMA_VERSION = 1;

export const USER_PROJECTS_TABLES = Object.freeze({
  USER_PROJECTS: "sg_user_projects",
});

let schemaReadyPromise = null;

function normalizeQueryFn(queryFn) {
  return typeof queryFn === "function" ? queryFn : queryPostgres;
}

async function run(queryFn, sql, params = []) {
  return normalizeQueryFn(queryFn)(sql, params);
}

export function getUserProjectsSchemaSql() {
  return [
    `CREATE TABLE IF NOT EXISTS sg_user_projects (
      id TEXT NOT NULL,
      owner_global_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      visibility TEXT NOT NULL DEFAULT 'private',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (owner_global_user_id, id),
      CONSTRAINT sg_user_projects_status_check CHECK (status IN ('active', 'archived', 'suspended', 'deleted')),
      CONSTRAINT sg_user_projects_visibility_check CHECK (visibility IN ('private', 'shared', 'public_readonly'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS sg_user_projects_owner_slug_idx
      ON sg_user_projects (owner_global_user_id, slug)`,
    `CREATE INDEX IF NOT EXISTS sg_user_projects_owner_status_idx
      ON sg_user_projects (owner_global_user_id, status, updated_at DESC)`,
  ];
}

export async function createUserProjectsSchema({ queryFn } = {}) {
  for (const sql of getUserProjectsSchemaSql()) {
    const result = await run(queryFn, sql);
    if (!result.ok) return result;
  }

  return {
    ok: true,
    type: "user_projects_schema_ready",
    schemaVersion: USER_PROJECTS_SCHEMA_VERSION,
    tables: USER_PROJECTS_TABLES,
  };
}

export async function ensureUserProjectsSchema({ queryFn, force = false } = {}) {
  if (force || queryFn) {
    return createUserProjectsSchema({ queryFn });
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = createUserProjectsSchema({ queryFn });
  }

  const result = await schemaReadyPromise;

  if (!result.ok) {
    schemaReadyPromise = null;
  }

  return result;
}

export default {
  USER_PROJECTS_SCHEMA_VERSION,
  USER_PROJECTS_TABLES,
  getUserProjectsSchemaSql,
  createUserProjectsSchema,
  ensureUserProjectsSchema,
};
