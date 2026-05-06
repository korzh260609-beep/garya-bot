// AGENT NOTE:
// SG 2.0 GitHub approval service.
// Purpose: isolate GitHub write-approval preparation, execution, and cancellation from the tool wrapper.
// Do not add generic GitHub request parsing, OpenAI tool orchestration, or Telegram callback formatting here.

import crypto from "crypto";
import {
  buildApprovalWarning,
  cleanupExpiredGithubApprovals,
  deletePendingGithubApproval,
  evaluateGitHubWritePolicy,
  executeGitHubApiRequest,
  getPendingGithubApproval,
  listPendingGithubApprovals,
  setPendingGithubApproval,
  summarizeGitHubWriteRequest,
} from "./index.js";

const APPROVAL_TTL_MS = 10 * 60 * 1000;

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function hashGitHubRequest({ method, path, query, body }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableValue({ method, path, query, body })))
    .digest("hex")
    .slice(0, 16);
}

function createApprovalId() {
  return `SG-WRITE-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function extractGithubApprovalId(text = "") {
  const match = String(text || "")
    .trim()
    .match(/^МОЖНО\s+(SG-WRITE-[A-F0-9]{8,16})$/iu);

  return match ? match[1].toUpperCase() : null;
}

export function prepareGithubWriteApproval(
  { method, path, query, body, headers, approvalContext, currentBranch },
  context = {}
) {
  cleanupExpiredGithubApprovals();

  const policyCheck = evaluateGitHubWritePolicy({ context, hasApproval: false });

  if (!context?.isMonarch || !policyCheck.missing.includes("explicit_approval")) {
    return {
      ok: false,
      status: 403,
      method,
      path,
      query,
      requires_approval: true,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write preparation is blocked by SG behavior policy.",
    };
  }

  if (!approvalContext) {
    return {
      ok: false,
      status: 400,
      method,
      path,
      query,
      requires_approval: true,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write approval requires semantic approvalContextJson: change_summary, reason and specific_impact are required.",
    };
  }

  const request = { method, path, query, body, headers };
  const requestHash = hashGitHubRequest(request);
  const userId = context.userId ? String(context.userId) : "unknown";

  for (const [existingId, pending] of listPendingGithubApprovals()) {
    if (pending.requestHash === requestHash && pending.userId === userId) {
      const warning = buildApprovalWarning({
        approvalId: existingId,
        summary: pending.summary,
        requestHash,
      });

      return {
        ok: true,
        status: 202,
        method,
        path,
        query,
        requires_approval: true,
        executed: false,
        approval_id: existingId,
        request_hash: requestHash,
        confirmation_phrase: `МОЖНО ${existingId}`,
        expires_at: new Date(pending.expiresAt).toISOString(),
        summary: pending.summary,
        policy_check: policyCheck,
        warning,
      };
    }
  }

  const approvalId = createApprovalId();
  const summary = summarizeGitHubWriteRequest({
    method,
    path,
    query,
    body,
    approvalContext,
    currentBranch,
  });
  const expiresAt = Date.now() + APPROVAL_TTL_MS;

  setPendingGithubApproval(approvalId, {
    approvalId,
    userId,
    request,
    requestHash,
    summary,
    createdAt: Date.now(),
    expiresAt,
  });

  const warning = buildApprovalWarning({ approvalId, summary, requestHash });

  return {
    ok: true,
    status: 202,
    method,
    path,
    query,
    requires_approval: true,
    executed: false,
    approval_id: approvalId,
    request_hash: requestHash,
    confirmation_phrase: `МОЖНО ${approvalId}`,
    expires_at: new Date(expiresAt).toISOString(),
    summary,
    policy_check: policyCheck,
    warning,
  };
}

export async function executePendingGithubApproval(approvalId, context = {}) {
  cleanupExpiredGithubApprovals();

  const normalizedApprovalId = String(approvalId || "").trim().toUpperCase();

  if (!normalizedApprovalId) {
    return {
      ok: false,
      status: 400,
      executed: false,
      error: "GitHub approval id is required.",
    };
  }

  const pending = getPendingGithubApproval(normalizedApprovalId);

  if (!pending) {
    return {
      ok: false,
      status: 404,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval was not found or expired.",
    };
  }

  const userId = context.userId ? String(context.userId) : "unknown";

  if (pending.userId !== userId) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval belongs to another user/session.",
    };
  }

  const policyCheck = evaluateGitHubWritePolicy({ context, hasApproval: true });

  if (!policyCheck.ok) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      policy_check: policyCheck,
      error: "GitHub write execution is blocked by SG behavior policy.",
    };
  }

  deletePendingGithubApproval(normalizedApprovalId);

  const result = await executeGitHubApiRequest(pending.request);

  return {
    ...result,
    approval_id: normalizedApprovalId,
    request_hash: pending.requestHash,
    requires_approval: false,
    executed: true,
    policy_check: policyCheck,
    summary: pending.summary,
  };
}

export function cancelPendingGithubApproval(approvalId, context = {}) {
  cleanupExpiredGithubApprovals();

  const normalizedApprovalId = String(approvalId || "").trim().toUpperCase();

  if (!normalizedApprovalId) {
    return {
      ok: false,
      status: 400,
      executed: false,
      error: "GitHub approval id is required.",
    };
  }

  if (!context?.isMonarch) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "Only the Monarch can cancel GitHub write approvals.",
    };
  }

  const pending = getPendingGithubApproval(normalizedApprovalId);

  if (!pending) {
    return {
      ok: false,
      status: 404,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval was not found or expired.",
    };
  }

  const userId = context.userId ? String(context.userId) : "unknown";

  if (pending.userId !== userId) {
    return {
      ok: false,
      status: 403,
      approval_id: normalizedApprovalId,
      executed: false,
      error: "GitHub write approval belongs to another user/session.",
    };
  }

  deletePendingGithubApproval(normalizedApprovalId);

  return {
    ok: true,
    status: 200,
    approval_id: normalizedApprovalId,
    executed: false,
    cancelled: true,
    summary: pending.summary,
  };
}
