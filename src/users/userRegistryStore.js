// AGENT NOTE:
// SG 2.0 durable user registry store.
// Purpose: create and resolve globalUserId records from provider identities.
// Do not add transport behavior, permissions expansion, memory writes, observation writes, billing, or AI calls here.

import crypto from "node:crypto";
import { queryPostgres } from "../db/postgresClient.js";
import {
  GLOBAL_USER_ID_PREFIX,
  MONARCH_GLOBAL_USER_ID,
  USER_ROLES,
  buildProviderIdentityRef,
} from "./globalIdentity.js";
import { ensureUsersRegistrySchema } from "./userRegistrySchema.js";

function createDurableGlobalUserId() {
  return `${GLOBAL_USER_ID_PREFIX}${crypto.randomUUID()}`;
}

async function findProviderIdentity({ provider, providerUserId } = {}) {
  return queryPostgres(
    `SELECT global_user_id FROM sg_user_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1`,
    [provider, providerUserId],
  );
}

async function createUser({ globalUserId, role = USER_ROLES.GUEST, metadata = {} } = {}) {
  return queryPostgres(
    `INSERT INTO sg_users (global_user_id, role, metadata)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (global_user_id) DO NOTHING`,
    [globalUserId, role, JSON.stringify(metadata || {})],
  );
}

async function createProviderIdentity({ provider, providerUserId, globalUserId, metadata = {} } = {}) {
  return queryPostgres(
    `INSERT INTO sg_user_identities (provider, provider_user_id, global_user_id, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (provider, provider_user_id) DO UPDATE
     SET updated_at = NOW()
     RETURNING global_user_id`,
    [provider, providerUserId, globalUserId, JSON.stringify(metadata || {})],
  );
}

export async function resolveOrCreateGlobalUserIdentity({
  provider,
  providerUserId,
  isMonarch = false,
  metadata = {},
} = {}) {
  const providerIdentity = buildProviderIdentityRef({ provider, providerUserId });

  if (providerIdentity.providerUserId === "unknown") {
    return {
      ok: false,
      reason: "provider_user_id_missing",
      identityStatus: "pending_registry",
      globalUserId: null,
      providerIdentity,
    };
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return {
      ok: false,
      reason: schema.reason || "users_registry_unavailable",
      identityStatus: "pending_registry",
      globalUserId: null,
      providerIdentity,
    };
  }

  const existing = await findProviderIdentity(providerIdentity);

  if (!existing.ok) {
    return {
      ok: false,
      reason: existing.reason || "provider_identity_lookup_failed",
      identityStatus: "pending_registry",
      globalUserId: null,
      providerIdentity,
    };
  }

  const existingGlobalUserId = existing.rows?.[0]?.global_user_id || "";

  if (existingGlobalUserId) {
    return {
      ok: true,
      identityStatus: "durable",
      globalUserId: existingGlobalUserId,
      providerIdentity,
      created: false,
    };
  }

  const globalUserId = isMonarch ? MONARCH_GLOBAL_USER_ID : createDurableGlobalUserId();
  const role = isMonarch ? USER_ROLES.MONARCH : USER_ROLES.GUEST;
  const user = await createUser({ globalUserId, role, metadata });

  if (!user.ok) {
    return {
      ok: false,
      reason: user.reason || "user_create_failed",
      identityStatus: "pending_registry",
      globalUserId: null,
      providerIdentity,
    };
  }

  const link = await createProviderIdentity({
    ...providerIdentity,
    globalUserId,
    metadata,
  });

  if (!link.ok) {
    return {
      ok: false,
      reason: link.reason || "provider_identity_create_failed",
      identityStatus: "pending_registry",
      globalUserId: null,
      providerIdentity,
    };
  }

  return {
    ok: true,
    identityStatus: "durable",
    globalUserId,
    providerIdentity,
    created: true,
  };
}
