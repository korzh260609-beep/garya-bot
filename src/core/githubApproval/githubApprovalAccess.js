// AGENT NOTE:
// SG 2.0 GitHub approval access helpers.
// Purpose: isolate Monarch/access validation for GitHub approval callbacks.
// Do not add GitHub execution, Telegram delivery, or callback parsing here.

import { checkEarlyAccess } from "../../permissions/monarchGate.js";
import { resolveIdentity } from "../../users/identityResolver.js";

export function resolveGithubApprovalIdentity(context = {}) {
  return resolveIdentity(context);
}

export function checkGithubApprovalAccess(identity) {
  const access = checkEarlyAccess({ userId: identity.platformUserId });

  return {
    allowed: Boolean(access.allowed && identity.isMonarch),
    access,
  };
}

export function buildGithubApprovalAccessDeniedReply(identity) {
  return {
    ok: false,
    handled: true,
    identity,
    reply: "❌ GitHub-действие доступно только монарху.",
  };
}
