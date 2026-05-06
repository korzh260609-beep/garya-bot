// AGENT NOTE:
// SG 2.0 GitHub approval executor.
// Purpose: isolate approval callback execution dispatch from handler orchestration.
// Do not parse callback_data, resolve identity, or send Telegram messages here.

import {
  cancelPendingGithubApproval,
  executePendingGithubApproval,
} from "../../tools/githubTool.js";
import {
  formatGithubCancelResult,
  formatGithubWriteResult,
} from "./githubApprovalResultFormatter.js";

export function buildGithubApprovalExecutionContext(identity = {}) {
  return {
    userId: identity.platformUserId,
    globalUserId: identity.globalUserId,
    role: identity.role,
    isMonarch: identity.isMonarch,
  };
}

export async function executeGithubApprovalAction({ parsed, identity }) {
  const approvalContext = buildGithubApprovalExecutionContext(identity);

  if (parsed.action === "cancel") {
    const result = cancelPendingGithubApproval(parsed.approvalId, approvalContext);

    return {
      ok: result.ok,
      handled: true,
      identity,
      result,
      reply: formatGithubCancelResult(result),
    };
  }

  const result = await executePendingGithubApproval(parsed.approvalId, approvalContext);

  return {
    ok: result.ok,
    handled: true,
    identity,
    result,
    reply: formatGithubWriteResult(result),
  };
}
