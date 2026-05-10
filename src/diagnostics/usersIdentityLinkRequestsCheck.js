// AGENT NOTE:
// SG 2.0 users identity link requests diagnostic check.
// Purpose: verify the identity-link-request boundary without creating provider links or pending requests.
// Do not add Telegram slash commands, AI calls, repo writes, memory writes, DB writes, or raw provider ID output here.

import {
  IDENTITY_LINK_REQUEST_STATUSES,
  buildIdentityLinkRequestCandidate,
  buildIdentityLinkRequestId,
} from "../users/userIdentityLinkRequests.js";

const DIAGNOSTIC_PROVIDER = "api";
const DIAGNOSTIC_PROVIDER_USER_ID = "users_identity_link_requests_selfcheck";
const DIAGNOSTIC_GLOBAL_USER_ID = "usr_48cc07c069030fb3";

function buildSafeResult(data = {}) {
  return {
    ok: Boolean(data.ok),
    type: "users_identity_link_requests",
    requestIdDeterministic: Boolean(data.requestIdDeterministic),
    candidateValid: Boolean(data.candidateValid),
    pendingByDefault: Boolean(data.pendingByDefault),
    explicitConfirmationRequired: Boolean(data.explicitConfirmationRequired),
    autoLinkingBlocked: Boolean(data.autoLinkingBlocked),
    noWriteAttempted: Boolean(data.noWriteAttempted),
    rawProviderUserIdExposed: false,
    summary: data.summary || "Users identity link requests check completed.",
    error: data.error || null,
  };
}

export async function runUsersIdentityLinkRequestsCheck() {
  try {
    const providerIdentity = {
      provider: DIAGNOSTIC_PROVIDER,
      providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
    };

    const requestId = buildIdentityLinkRequestId({
      providerIdentity,
      targetGlobalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
    });

    const sameRequestId = buildIdentityLinkRequestId({
      providerIdentity,
      targetGlobalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
    });

    const candidate = buildIdentityLinkRequestCandidate({
      provider: DIAGNOSTIC_PROVIDER,
      providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
      targetGlobalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
      requestedByGlobalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
      metadata: {
        source: "usersIdentityLinkRequestsCheck",
        purpose: "diagnostic_selfcheck",
      },
    });

    const requestIdDeterministic = requestId === sameRequestId && requestId.startsWith("ilr_");
    const candidateValid = Boolean(candidate.ok);
    const pendingByDefault = candidate.rules?.status === IDENTITY_LINK_REQUEST_STATUSES.PENDING;
    const explicitConfirmationRequired = candidate.rules?.requiresExplicitConfirmation === true;
    const autoLinkingBlocked = candidate.rules?.noAutoLinking === true;
    const noWriteAttempted = true;
    const rawProviderUserIdExposed = Object.prototype.hasOwnProperty.call(candidate, "providerUserId");
    const ok = requestIdDeterministic
      && candidateValid
      && pendingByDefault
      && explicitConfirmationRequired
      && autoLinkingBlocked
      && noWriteAttempted
      && !rawProviderUserIdExposed;

    return buildSafeResult({
      ok,
      requestIdDeterministic,
      candidateValid,
      pendingByDefault,
      explicitConfirmationRequired,
      autoLinkingBlocked,
      noWriteAttempted,
      summary: ok
        ? "Users identity link requests boundary is safe: request IDs are deterministic, candidates are pending-gated, and no write is attempted."
        : "Users identity link requests boundary check failed.",
      error: ok ? null : "users_identity_link_requests_check_failed",
    });
  } catch (error) {
    return buildSafeResult({
      ok: false,
      error: error?.message || "users_identity_link_requests_check_failed",
      summary: error?.message || "Users identity link requests check failed.",
    });
  }
}

export default {
  runUsersIdentityLinkRequestsCheck,
};
