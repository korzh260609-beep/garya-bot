// AGENT NOTE:
// SG 2.0 GitHub write policy adapter.
// Purpose: isolate GitHub write policy evaluation from request/approval execution logic.
// Do not add approval state, GitHub API calls, or Telegram formatting here.

import { evaluateActionPolicy } from "../../behavior/actionPolicy.js";
import { SG_ACTION_TYPES } from "../../behavior/actionTypes.js";

function buildIdentityFromContext(context = {}) {
  return {
    isMonarch: Boolean(context.isMonarch),
    role: context.role || "guest",
    platformUserId: context.userId || null,
    globalUserId: context.globalUserId || null,
  };
}

export function evaluateGitHubWritePolicy({ context = {}, hasApproval = false }) {
  return evaluateActionPolicy({
    actionType: SG_ACTION_TYPES.MODIFY_REPO,
    identity: buildIdentityFromContext(context),
    hasApproval,
    hasSource: true,
    hasPlan: true,
  });
}
