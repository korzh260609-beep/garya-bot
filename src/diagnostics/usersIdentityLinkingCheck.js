// AGENT NOTE:
// SG 2.0 users identity linking diagnostic check.
// Purpose: verify the identity-linking boundary without auto-linking or writing provider links.
// Do not add Telegram slash commands, AI calls, repo writes, memory writes, or raw provider ID output here.

import {
  buildUserIdentityLinkCandidate,
  linkProviderIdentityToGlobalUser,
} from "../users/userIdentityLinking.js";

const DIAGNOSTIC_PROVIDER = "api";
const DIAGNOSTIC_PROVIDER_USER_ID = "users_identity_linking_selfcheck";
const DIAGNOSTIC_GLOBAL_USER_ID = "usr_48cc07c069030fb3";

function buildSafeResult(data = {}) {
  return {
    ok: Boolean(data.ok),
    type: "users_identity_linking",
    candidateValid: Boolean(data.candidateValid),
    confirmationRequired: Boolean(data.confirmationRequired),
    autoLinkingBlocked: Boolean(data.autoLinkingBlocked),
    noWriteAttempted: Boolean(data.noWriteAttempted),
    rawProviderUserIdExposed: false,
    summary: data.summary || "Users identity linking check completed.",
    error: data.error || null,
  };
}

export async function runUsersIdentityLinkingCheck() {
  try {
    const candidate = buildUserIdentityLinkCandidate({
      provider: DIAGNOSTIC_PROVIDER,
      providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
      globalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
      metadata: {
        source: "usersIdentityLinkingCheck",
        purpose: "diagnostic_selfcheck",
      },
    });

    const rejected = await linkProviderIdentityToGlobalUser({
      provider: DIAGNOSTIC_PROVIDER,
      providerUserId: DIAGNOSTIC_PROVIDER_USER_ID,
      globalUserId: DIAGNOSTIC_GLOBAL_USER_ID,
      metadata: {
        source: "usersIdentityLinkingCheck",
        purpose: "diagnostic_selfcheck_unconfirmed",
      },
      confirmed: false,
    });

    const candidateValid = Boolean(candidate.ok);
    const confirmationRequired = rejected?.reason === "identity_link_confirmation_required";
    const autoLinkingBlocked = rejected?.ok === false && confirmationRequired;
    const noWriteAttempted = autoLinkingBlocked;
    const ok = candidateValid && confirmationRequired && autoLinkingBlocked && noWriteAttempted;

    return buildSafeResult({
      ok,
      candidateValid,
      confirmationRequired,
      autoLinkingBlocked,
      noWriteAttempted,
      summary: ok
        ? "Users identity linking boundary is safe: candidate builds, unconfirmed linking is blocked, and no provider link is written."
        : "Users identity linking boundary check failed.",
      error: ok ? null : "users_identity_linking_check_failed",
    });
  } catch (error) {
    return buildSafeResult({
      ok: false,
      error: error?.message || "users_identity_linking_check_failed",
      summary: error?.message || "Users identity linking check failed.",
    });
  }
}

export default {
  runUsersIdentityLinkingCheck,
};
