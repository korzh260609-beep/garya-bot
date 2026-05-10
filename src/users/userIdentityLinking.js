// AGENT NOTE:
// SG 2.0 user identity linking skeleton.
// Purpose: define a safe boundary for linking multiple provider identities to one globalUserId.
// Do not auto-link identities, add transport-specific behavior, write memory, expand permissions, or bypass confirmation policy here.

import { queryPostgres, withPostgresTransaction } from "../db/postgresClient.js";
import { buildProviderIdentityRef, isDurableGlobalUserId } from "./globalIdentity.js";
import { ensureUsersRegistrySchema } from "./userRegistrySchema.js";

function normalizeGlobalUserId(globalUserId) {
  return typeof globalUserId === "string" ? globalUserId.trim() : "";
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function buildRejectedResult(reason, extra = {}) {
  return {
    ok: false,
    type: "user_identity_linking_result",
    reason,
    ...extra,
  };
}

export function buildUserIdentityLinkCandidate({ provider, providerUserId, globalUserId, metadata = {} } = {}) {
  const providerIdentity = buildProviderIdentityRef({ provider, providerUserId });
  const normalizedGlobalUserId = normalizeGlobalUserId(globalUserId);

  return {
    ok: providerIdentity.providerUserId !== "unknown" && isDurableGlobalUserId(normalizedGlobalUserId),
    type: "user_identity_link_candidate",
    providerIdentity,
    globalUserId: normalizedGlobalUserId,
    metadata: normalizeMetadata(metadata),
    rules: {
      requiresExplicitConfirmation: true,
      noAutoLinking: true,
      noTransportSpecificBehavior: true,
      noRawProviderIdInReports: true,
    },
  };
}

export async function findGlobalUserByProviderIdentity({ provider, providerUserId } = {}) {
  const providerIdentity = buildProviderIdentityRef({ provider, providerUserId });

  if (providerIdentity.providerUserId === "unknown") {
    return buildRejectedResult("provider_user_id_missing", { providerIdentity });
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildRejectedResult(schema.reason || "users_registry_unavailable", { providerIdentity });
  }

  const result = await queryPostgres(
    `SELECT global_user_id FROM sg_user_identities WHERE provider = $1 AND provider_user_id = $2 LIMIT 1`,
    [providerIdentity.provider, providerIdentity.providerUserId],
  );

  if (!result.ok) {
    return buildRejectedResult(result.reason || "provider_identity_lookup_failed", { providerIdentity });
  }

  const globalUserId = result.rows?.[0]?.global_user_id || "";

  return {
    ok: Boolean(globalUserId),
    type: "user_identity_lookup_result",
    found: Boolean(globalUserId),
    globalUserId: globalUserId || null,
    providerIdentity,
  };
}

export async function linkProviderIdentityToGlobalUser({
  provider,
  providerUserId,
  globalUserId,
  metadata = {},
  confirmed = false,
} = {}) {
  const candidate = buildUserIdentityLinkCandidate({ provider, providerUserId, globalUserId, metadata });

  if (!candidate.ok) {
    return buildRejectedResult("invalid_identity_link_candidate", { candidate });
  }

  if (!confirmed) {
    return buildRejectedResult("identity_link_confirmation_required", { candidate });
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildRejectedResult(schema.reason || "users_registry_unavailable", { candidate });
  }

  const metadataJson = JSON.stringify({
    ...candidate.metadata,
    source: candidate.metadata.source || "userIdentityLinking",
    link_confirmed: true,
  });

  const result = await withPostgresTransaction(async (client) => {
    const user = await client.query(
      `SELECT global_user_id FROM sg_users WHERE global_user_id = $1 LIMIT 1`,
      [candidate.globalUserId],
    );

    if (!user.rows?.[0]?.global_user_id) {
      return {
        ok: false,
        reason: "global_user_not_found",
      };
    }

    const link = await client.query(
      `INSERT INTO sg_user_identities (provider, provider_user_id, global_user_id, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (provider, provider_user_id) DO UPDATE
       SET global_user_id = EXCLUDED.global_user_id,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
       RETURNING global_user_id`,
      [
        candidate.providerIdentity.provider,
        candidate.providerIdentity.providerUserId,
        candidate.globalUserId,
        metadataJson,
      ],
    );

    return {
      ok: true,
      rows: link.rows || [],
      rowCount: link.rowCount || 0,
    };
  });

  if (!result.ok) {
    return buildRejectedResult(result.reason || "identity_link_failed", { candidate });
  }

  return {
    ok: true,
    type: "user_identity_linking_result",
    linked: true,
    globalUserId: result.rows?.[0]?.global_user_id || candidate.globalUserId,
    provider: candidate.providerIdentity.provider,
    policy: {
      confirmed: true,
      rawProviderUserIdExposed: false,
    },
  };
}

export default {
  buildUserIdentityLinkCandidate,
  findGlobalUserByProviderIdentity,
  linkProviderIdentityToGlobalUser,
};
