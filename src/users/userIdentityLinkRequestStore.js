// AGENT NOTE:
// SG 2.0 user identity link request store.
// Purpose: keep SQL persistence for identity link requests separate from request policy/service logic.
// Do not add transport behavior, memory writes, AI calls, or policy bypasses here.

import { queryPostgres } from "../db/postgresClient.js";
import { ensureUsersRegistrySchema } from "./userRegistrySchema.js";
import { IDENTITY_LINK_REQUEST_STATUSES } from "./userIdentityLinkRequestConstants.js";
import {
  buildIdentityLinkRequestRejectedResult,
  normalizeMetadata,
  normalizeText,
} from "./userIdentityLinkRequestHelpers.js";

export async function insertIdentityLinkRequest(candidate) {
  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildIdentityLinkRequestRejectedResult(schema.reason || "users_registry_unavailable", { candidate });
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
    return buildIdentityLinkRequestRejectedResult(result.reason || "identity_link_request_create_failed", { candidate });
  }

  return {
    ok: true,
    type: "user_identity_link_request_store_result",
    row: result.rows?.[0] || null,
  };
}

export async function getIdentityLinkRequestRow(requestId) {
  const normalizedRequestId = normalizeText(requestId);

  if (!normalizedRequestId) {
    return buildIdentityLinkRequestRejectedResult("identity_link_request_id_missing");
  }

  const schema = await ensureUsersRegistrySchema();

  if (!schema.ok) {
    return buildIdentityLinkRequestRejectedResult(schema.reason || "users_registry_unavailable");
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
    return buildIdentityLinkRequestRejectedResult(result.reason || "identity_link_request_lookup_failed");
  }

  const row = result.rows?.[0];

  if (!row) {
    return buildIdentityLinkRequestRejectedResult("identity_link_request_not_found");
  }

  return {
    ok: true,
    type: "user_identity_link_request_internal_lookup_result",
    found: true,
    row,
  };
}

export async function markIdentityLinkRequestApproved({ requestId, approvalMethod, approverGlobalUserId = "" } = {}) {
  const result = await queryPostgres(
    `UPDATE sg_user_identity_link_requests
     SET status = $2,
         approval_method = $3,
         approver_global_user_id = $4,
         resolved_at = NOW(),
         updated_at = NOW()
     WHERE request_id = $1
     RETURNING request_id, status, target_global_user_id`,
    [
      requestId,
      IDENTITY_LINK_REQUEST_STATUSES.APPROVED,
      approvalMethod,
      normalizeText(approverGlobalUserId) || null,
    ],
  );

  if (!result.ok) {
    return buildIdentityLinkRequestRejectedResult(result.reason || "identity_link_request_update_failed", {
      requestId,
    });
  }

  return {
    ok: true,
    type: "user_identity_link_request_store_result",
    row: result.rows?.[0] || null,
  };
}

export async function markIdentityLinkRequestRejected({ requestId, rejectedByGlobalUserId = "", metadata = {} } = {}) {
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
      requestId,
      IDENTITY_LINK_REQUEST_STATUSES.REJECTED,
      normalizeText(rejectedByGlobalUserId) || null,
      JSON.stringify(normalizeMetadata(metadata)),
    ],
  );

  if (!result.ok) {
    return buildIdentityLinkRequestRejectedResult(result.reason || "identity_link_request_reject_failed", {
      requestId,
    });
  }

  return {
    ok: true,
    type: "user_identity_link_request_store_result",
    row: result.rows?.[0] || null,
  };
}

export default {
  insertIdentityLinkRequest,
  getIdentityLinkRequestRow,
  markIdentityLinkRequestApproved,
  markIdentityLinkRequestRejected,
};
