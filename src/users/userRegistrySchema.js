// AGENT NOTE:
// SG 2.0 users registry schema boundary.
// Purpose: define durable users/user_identities storage without mixing transport, permissions, memory, or AI logic.
// Do not add Telegram-specific behavior, observation writes, project memory writes, or billing here.

import { queryPostgres } from "../db/postgresClient.js";

export const USERS_REGISTRY_SCHEMA_VERSION = 2;

export const USERS_REGISTRY_TABLES = Object.freeze({
  USERS: "sg_users",
  USER_IDENTITIES: "sg_user_identities",
  USER_IDENTITY_LINK_REQUESTS: "sg_user_identity_link_requests",
});

let schemaReadyPromise = null;

async function createUsersRegistrySchema() {
  const usersResult = await queryPostgres(`
    CREATE TABLE IF NOT EXISTS sg_users (
      global_user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL DEFAULT 'guest',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  if (!usersResult.ok) return usersResult;

  const identitiesResult = await queryPostgres(`
    CREATE TABLE IF NOT EXISTS sg_user_identities (
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      global_user_id TEXT NOT NULL REFERENCES sg_users(global_user_id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (provider, provider_user_id)
    )
  `);

  if (!identitiesResult.ok) return identitiesResult;

  const linkRequestsResult = await queryPostgres(`
    CREATE TABLE IF NOT EXISTS sg_user_identity_link_requests (
      request_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      target_global_user_id TEXT NOT NULL REFERENCES sg_users(global_user_id),
      requested_by_global_user_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approval_method TEXT,
      approver_global_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  if (!linkRequestsResult.ok) return linkRequestsResult;

  const pendingIndexResult = await queryPostgres(`
    CREATE UNIQUE INDEX IF NOT EXISTS sg_user_identity_link_requests_pending_idx
    ON sg_user_identity_link_requests (provider, provider_user_id, target_global_user_id)
    WHERE status = 'pending'
  `);

  if (!pendingIndexResult.ok) return pendingIndexResult;

  return {
    ok: true,
    type: "users_registry_schema_ready",
    schemaVersion: USERS_REGISTRY_SCHEMA_VERSION,
  };
}

export async function ensureUsersRegistrySchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = createUsersRegistrySchema();
  }

  const result = await schemaReadyPromise;

  if (!result.ok) {
    schemaReadyPromise = null;
  }

  return result;
}
