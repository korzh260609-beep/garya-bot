// AGENT NOTE:
// SG 2.0 user identity link request service boundary.
// Purpose: orchestrate pending requests before a provider identity is linked to a durable globalUserId.
// Do not add transport-specific behavior, auto-link identities, write memory, call AI, or bypass identity linking policy here.

import { linkProviderIdentityToGlobalUser } from "./userIdentityLinking.js";
import { IDENTITY_LINK_REQUEST_STATUSES } from "./userIdentityLinkRequestConstants.js";
import {
  buildIdentityLinkRequestCandidate,
  buildIdentityLinkRequestId,
  buildIdentityLinkRequestRejectedResult,
  sanitizeIdentityLinkRequestRow,
} from "./userIdentityLinkRequestHelpers.js";
import {
  getIdentityLinkRequestRow,
  insertIdentityLinkRequest,
  markIdentityLinkRequestApproved,
  markIdentityLinkRequestRejected,
} from "./userIdentityLinkRequestStore.js";

export { IDENTITY_LINK_REQUEST_STATUSES } from "./userIdentityLinkRequestConstants.js";
export {
  buildIdentityLinkRequestCandidate,
  buildIdentityLinkRequestId,
} from "./userIdentityLinkRequestHelpers.js";

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
    return buildIdentityLinkRequestRejectedResult("invalid_identity_link_request_candidate", { candidate });
  }

  const result = await insertIdentityLinkRequest(candidate);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    created: true,
    requestId: result.row?.request_id || candidate.requestId,
    status: result.row?.status || IDENTITY_LINK_REQUEST_STATUSES.PENDING,
    targetGlobalUserId: result.row?.target_global_user_id || candidate.targetGlobalUserId,
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
    return buildIdentityLinkRequestRejectedResult("identity_link_request_not_pending", {
      requestId: request.request_id,
    });
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
    return buildIdentityLinkRequestRejectedResult(link.reason || "identity_link_request_approval_failed", {
      requestId: request.request_id,
      policy: link.policy,
      approvalMethod: link.approvalMethod,
    });
  }

  const update = await markIdentityLinkRequestApproved({
    requestId: request.request_id,
    approvalMethod,
    approverGlobalUserId,
  });

  if (!update.ok) {
    return update;
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    approved: true,
    requestId: request.request_id,
    status: update.row?.status || IDENTITY_LINK_REQUEST_STATUSES.APPROVED,
    targetGlobalUserId: update.row?.target_global_user_id || request.target_global_user_id,
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
    return buildIdentityLinkRequestRejectedResult("identity_link_request_not_pending", {
      requestId: request.request_id,
    });
  }

  const result = await markIdentityLinkRequestRejected({
    requestId: request.request_id,
    rejectedByGlobalUserId,
    metadata,
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    type: "user_identity_link_request_result",
    rejected: true,
    requestId: request.request_id,
    status: result.row?.status || IDENTITY_LINK_REQUEST_STATUSES.REJECTED,
    targetGlobalUserId: result.row?.target_global_user_id || request.target_global_user_id,
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
