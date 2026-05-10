// AGENT NOTE:
// SG 2.0 user identity link request helpers.
// Purpose: keep pure normalization, ID-building, candidate-building, and sanitizing separate from DB/service logic.
// Do not add database queries, transport behavior, memory writes, or AI calls here.

import crypto from "node:crypto";

import { buildProviderIdentityRef, isDurableGlobalUserId } from "./globalIdentity.js";
import { IDENTITY_LINK_REQUEST_STATUSES } from "./userIdentityLinkRequestConstants.js";

export function normalizeText(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

export function buildIdentityLinkRequestRejectedResult(reason, extra = {}) {
  return {
    ok: false,
    type: "user_identity_link_request_result",
    reason,
    ...extra,
  };
}

export function sanitizeIdentityLinkRequestRow(row = {}) {
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

export default {
  normalizeText,
  normalizeMetadata,
  buildIdentityLinkRequestRejectedResult,
  sanitizeIdentityLinkRequestRow,
  buildIdentityLinkRequestId,
  buildIdentityLinkRequestCandidate,
};
