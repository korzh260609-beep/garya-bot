// AGENT NOTE:
// SG 2.0 GitHub approval callback handler.
// Purpose: keep Telegram button approval decisions in core, not inside transport.
// Do not add GitHub request construction, AI calls, or Telegram-specific delivery here.

import {
  cancelPendingGithubApproval,
  executePendingGithubApproval,
} from "../tools/githubTool.js";
import { checkEarlyAccess } from "../permissions/monarchGate.js";
import { resolveIdentity } from "../users/identityResolver.js";

export function parseGithubApprovalCallbackData(data = "") {
  const match = String(data || "")
    .trim()
    .match(/^sg_write_(confirm|cancel):(SG-WRITE-[A-F0-9]{8,16})$/i);

  if (!match) return null;

  return {
    action: match[1].toLowerCase(),
    approvalId: match[2].toUpperCase(),
  };
}

function formatSummary(summary = {}) {
  return [
    `repo: ${summary.repo || "unknown"}`,
    `branch: ${summary.branch || "unknown"}`,
    `action: ${summary.action || "unknown"}`,
    `target: ${summary.target || "unknown"}`,
  ].join("\n");
}

function formatGithubWriteResult(result = {}) {
  if (!result.ok) {
    return [
      "❌ GitHub-действие не выполнено.",
      "",
      `approval: ${result.approval_id || "unknown"}`,
      `error: ${result.error || "unknown error"}`,
    ].join("\n");
  }

  const commitSha = result?.data?.commit?.sha || result?.data?.sha || null;

  return [
    "✅ GitHub-действие выполнено.",
    "",
    `approval: ${result.approval_id || "unknown"}`,
    `status: ${result.status || "unknown"}`,
    "",
    formatSummary(result.summary),
    commitSha ? `\ncommit: ${commitSha}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatGithubCancelResult(result = {}) {
  if (!result.ok) {
    return [
      "❌ GitHub-действие не отменено.",
      "",
      `approval: ${result.approval_id || "unknown"}`,
      `error: ${result.error || "unknown error"}`,
    ].join("\n");
  }

  return [
    "✅ GitHub-действие отменено.",
    "",
    `approval: ${result.approval_id || "unknown"}`,
    "Запись в репозиторий не выполнялась.",
  ].join("\n");
}

export async function handleGithubApprovalCallback(context = {}, data = "") {
  const parsed = parseGithubApprovalCallbackData(data);

  if (!parsed) {
    return {
      ok: false,
      handled: false,
      reply: "Это не GitHub approval callback.",
    };
  }

  const identity = resolveIdentity(context);
  const access = checkEarlyAccess({ userId: identity.platformUserId });

  if (!access.allowed || !identity.isMonarch) {
    return {
      ok: false,
      handled: true,
      identity,
      reply: "❌ GitHub-действие доступно только монарху.",
    };
  }

  const approvalContext = {
    userId: identity.platformUserId,
    globalUserId: identity.globalUserId,
    role: identity.role,
    isMonarch: identity.isMonarch,
  };

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
