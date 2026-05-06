// AGENT NOTE:
// SG 2.0 GitHub approval callback handler.
// Purpose: orchestrate Telegram button approval decisions in core, not inside transport.
// Do not add GitHub request construction, AI calls, or Telegram-specific delivery here.

import {
  buildGithubApprovalAccessDeniedReply,
  checkGithubApprovalAccess,
  executeGithubApprovalAction,
  parseGithubApprovalCallbackData,
  resolveGithubApprovalIdentity,
} from "./githubApproval/index.js";

export { parseGithubApprovalCallbackData };

export async function handleGithubApprovalCallback(context = {}, data = "") {
  const parsed = parseGithubApprovalCallbackData(data);

  if (!parsed) {
    return {
      ok: false,
      handled: false,
      reply: "Это не GitHub approval callback.",
    };
  }

  const identity = resolveGithubApprovalIdentity(context);
  const approvalAccess = checkGithubApprovalAccess(identity);

  if (!approvalAccess.allowed) {
    return buildGithubApprovalAccessDeniedReply(identity);
  }

  return executeGithubApprovalAction({ parsed, identity });
}
