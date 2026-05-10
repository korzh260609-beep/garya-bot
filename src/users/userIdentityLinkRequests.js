// AGENT NOTE:
// SG 2.0 user identity link request boundary.
// Purpose: manage pending requests before a provider identity is linked to a durable globalUserId.
// Do not add transport-specific behavior, auto-link identities, write memory, call AI, or bypass identity linking policy here.

import crypto from "node:crypto";

import { queryPostgres } from "../db/postgresClient.js";
import { buildProviderIdentityRef, isDurableGlobalUserId } from "./globalIdentity.js";
import { ensureUsersRegistrySchema } from "./userRegistrySchema.js";
import { linkProviderIdentityToGlobalUser } from "./userIdentityLinking.js";

export const IDENTITY_LINK_REQUEST_STATUSES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function normalizeText(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function buildRejectedResult(reason, extra = {}) {
  return {
    ok: false,
    type: "user_identity_link_request_result",
    reason,
    ...extra,
  };
}

function sanitizeIdentityLinkRequestRow(row = {}) {
  return {
    requestId: row.request_id,
    provider: row.provider,
    targetGlobalUserId: row.target_global_user_id,
    requestedByGlobalUserId: row.requested_by_global_user_id || null,
    status: row.status,
    approvalMethod: row.approval_method || null,
    approverGlobalUserId: row.approver_global_user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || null,
    metadata: normalizeMetadata(row.metadata),
    policy: {
      rawProviderUserIdExposed: false,
    },
  };
}

export function buildIdentityLinkRequestId({ providerIdentity, targetGlobalUserId } = {}) {
  const provider = normalizeText(providerIdentity?.provider);
  const providerUserId = normalizeText(providerIdentity?.providerUserId);
  const target = normalizeText(targetGlobalUserId);
  const hash = crypto
    .createHash("sha256")
    .update(`${provider}:${providerUserId}:${target}`)
    .digest("hex")
    .slice(0, 24);

  return `ilr_${hash}`;
}

export function buildIdentityLinkRequestCandidate({
  provider,
  providerUserId,
  targetGlobalUserId,
  requestedByGlobalUserId = "",
  metadata = {},
} = {}) {
  const providerIdentity = buildProviderIdentityRef({ provider, providerUserId });
  const normalizedTargetGlobalUserId = normalizeText(targetGlobalUserId);
  const normalizedRequestedByGlobalUserId = normalizeText(requestedByGlobalUserId);
  const requestId = buildIdentityLinkRequestId({
    providerIdentity,
    targetGlobalUserId: normalizedTargetGlobalUserId,
  });

  return {
    ok: providerIdentity.providerUserId !== "unknown" && isDurableGlobalUserId(normalizedTargetGlobalUserId),
    type: "user_identity_link_request_candidate",
    requestId,
    providerIdentity,
    targetGlobalUserId: normalizedTargetGlobalUserId,
    requestedByGlobalUserId: normalizedRequestedByGlobalUserId || null,
    metadata: normalizeMetadata(metadata),
    rules: {
      status: IDENTITY_LINK_REQUEST_STATUSES.PENDING,
      requiresExplicitConfirmation: true,
      noAutoLinking: true,
      noTransportSpecificBehavior: true,
      noRawProviderIdInReports: true,
    },
  };
}

async function getIdentityLinkRequestRow(requestId) {
  const normalizedRequestId = normalizeText(requestId);

  if (!normalizedRequestId) {
    return buildRejectedResult("identity_link_request_id_missing");
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildRejectedResult(schema.reason || "users_registry_unavailable");
  }

  const result = await queryPostgres(
    `SELECT request_id,
            provider,
            provider_user_id,
            target_global_user_id,
            requested_by_global_user_id,
            status,
            approval_method,
            approver_global_user_id,
            created_at,
            updated_at,
            resolved_at,
            metadata
     FROM sg_user_identity_link_requests
     WHERE request_id = $1
     LIMIT 1`,
    [normalizedRequestId],
  );

  if (!result.ok) {
    return buildRejectedResult(result.reason || "identity_link_request_lookup_failed");
  }

  const row = result.rows?.[0];

  if (!row) {
    return buildRejectedResult("identity_link_request_not_found");
  }

  return {
    ok: true,
    type: "user_identity_link_request_internal_lookup_result",
    found: true,
    row,
  };
}

export async function createIdentityLinkRequest({
  provider,
  providerUserId,
  targetGlobalUserId,
  requestedByGlobalUserId = "",
  metadata = {},
} = {}) {
  const candidate = buildIdentityLinkRequestCandidate({
    provider,
    providerUserId,
    targetGlobalUserId,
    requestedByGlobalUserId,
    metadata,
  });

  if (!candidate.ok) {
    return buildRejectedResult("invalid_identity_link_request_candidate", { candidate });
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildRejectedResult(schema.reason || "users_registry_unavailable", { candidate });
  }

  const result = await queryPostgres(
    `INSERT INTO sg_user_identity_link_requests (
       request_id,
       provider,
       provider_user_id,
       target_global_user_id,
       requested_by_global_user_id,
       status,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (request_id) DO UPDATE
     SET metadata = EXCLUDED.metadata,
         updated_at = NOW()
     RETURNING request_id, status, target_global_user_id`,
    [
      candidate.requestId,
      candidate.providerIdentity.provider,
      candidate.providerIdentity.providerUserId,
      candidate.targetGlobalUserId,
      candidate.requestedByGlobalUserId,
      IDENTITY_LINK_REQUEST_STATUSES.PENDING,
      JSON.stringify({
        ...candidate.metadata,
        source: candidate.metadata.source || "userIdentityLinkRequests",
      }),
    ],
  );

  if (!result.ok) {
    return buildRejectedResult(result.reason || "identity_link_request_create_failed", { candidate });
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    created: true,
    requestId: result.rows?.[0]?.request_id || candidate.requestId,
    status: result.rows?.[0]?.status || IDENTITY_LINK_REQUEST_STATUSES.PENDING,
    targetGlobalUserId: result.rows?.[0]?.target_global_user_id || candidate.targetGlobalUserId,
    provider: candidate.providerIdentity.provider,
    policy: {
      requiresExplicitConfirmation: true,
      noAutoLinking: true,
      rawProviderUserIdExposed: false,
    },
  };
}

export async function getIdentityLinkRequest(requestId) {
  const lookup = await getIdentityLinkRequestRow(requestId);

  if (!lookup.ok) {
    return lookup;
  }

  return {
    ok: true,
    type: "user_identity_link_request_lookup_result",
    found: true,
    request: sanitizeIdentityLinkRequestRow(lookup.row),
  };
}

export async function approveIdentityLinkRequest({
  requestId,
  approvalMethod,
  approverRole,
  approverGlobalUserId = "",
} = {}) {
  const lookup = await getIdentityLinkRequestRow(requestId);

  if (!lookup.ok) {
    return lookup;
  }

  const request = lookup.row;

  if (request.status !== IDENTITY_LINK_REQUEST_STATUSES.PENDING) {
    return buildRejectedResult("identity_link_request_not_pending", { requestId: request.request_id });
  }

  const link = await linkProviderIdentityToGlobalUser({
    provider: request.provider,
    providerUserId: request.provider_user_id,
    globalUserId: request.target_global_user_id,
    metadata: {
      source: "userIdentityLinkRequests",
      request_id: request.request_id,
    },
    confirmed: true,
    approvalMethod,
    approverRole,
  });

  if (!link.ok) {
    return buildRejectedResult(link.reason || "identity_link_request_approval_failed", {
      requestId: request.request_id,
      policy: link.policy,
      approvalMethod: link.approvalMethod,
    });
  }

  const update = await queryPostgres(
    `UPDATE sg_user_identity_link_requests
     SET status = $2,
         approval_method = $3,
         approver_global_user_id = $4,
         resolved_at = NOW(),
         updated_at = NOW()
     WHERE request_id = $1
     RETURNING request_id, status, target_global_user_id`,
    [
      request.request_id,
      IDENTITY_LINK_REQUEST_STATUSES.APPROVED,
      approvalMethod,
      normalizeText(approverGlobalUserId) || null,
    ],
  );

  if (!update.ok) {
    return buildRejectedResult(update.reason || "identity_link_request_update_failed", {
      requestId: request.request_id,
    });
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    approved: true,
    requestId: request.request_id,
    status: update.rows?.[0]?.status || IDENTITY_LINK_REQUEST_STATUSES.APPROVED,
    targetGlobalUserId: update.rows?.[0]?.target_global_user_id || request.target_global_user_id,
    provider: request.provider,
    policy: {
      approvalMethod,
      rawProviderUserIdExposed: false,
    },
  };
}

export async function rejectIdentityLinkRequest({ requestId, rejectedByGlobalUserId = "", metadata = {} } = {}) {
  const lookup = await getIdentityLinkRequestRow(requestId);

  if (!lookup.ok) {
    return lookup;
  }

  const request = lookup.row;

  if (request.status !== IDENTITY_LINK_REQUEST_STATUSES.PENDING) {
    return buildRejectedResult("identity_link_request_not_pending", { requestId: request.request_id });
  }

  const result = await queryPostgres(
    `UPDATE sg_user_identity_link_requests
     SET status = $2,
         approver_global_user_id = $3,
         metadata = metadata || $4::jsonb,
         resolved_at = NOW(),
         updated_at = NOW()
     WHERE request_id = $1
     RETURNING request_id, status, target_global_user_id`,
    [
      request.request_id,
      IDENTITY_LINK_REQUEST_STATUSES.REJECTED,
      normalizeText(rejectedByGlobalUserId) || null,
      JSON.stringify(normalizeMetadata(metadata)),
    ],
  );

  if (!result.ok) {
    return buildRejectedResult(result.reason || "identity_link_request_reject_failed", {
      requestId: request.request_id,
    });
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    rejected: true,
    requestId: request.request_id,
    status: result.rows?.[0]?.status || IDENTITY_LINK_REQUEST_STATUSES.REJECTED,
    targetGlobalUserId: result.rows?.[0]?.target_global_user_id || request.target_global_user_id,
    provider: request.provider,
    policy: {
      rawProviderUserIdExposed: false,
    },
  };
}

export default {
  IDENTITY_LINK_REQUEST_STATUSES,
  buildIdentityLinkRequestCandidate,
  buildIdentityLinkRequestId,
  createIdentityLinkRequest,
  getIdentityLinkRequest,
  approveIdentityLinkRequest,
  rejectIdentityLinkRequest,
};
