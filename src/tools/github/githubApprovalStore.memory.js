// AGENT NOTE:
// SG 2.0 in-memory GitHub approval store.
// Purpose: isolate temporary write-approval state from the GitHub tool wrapper.
// This store is process-local and non-persistent by design for the current SG2 stage.
// Do not add GitHub API calls, behavior policy, or Telegram formatting here.

const pendingWriteApprovals = new Map();

export function cleanupExpiredGithubApprovals(now = Date.now()) {
  for (const [approvalId, pending] of pendingWriteApprovals.entries()) {
    if (!pending?.expiresAt || pending.expiresAt <= now) {
      pendingWriteApprovals.delete(approvalId);
    }
  }
}

export function getPendingGithubApproval(approvalId) {
  return pendingWriteApprovals.get(approvalId) || null;
}

export function setPendingGithubApproval(approvalId, pending) {
  pendingWriteApprovals.set(approvalId, pending);
}

export function deletePendingGithubApproval(approvalId) {
  return pendingWriteApprovals.delete(approvalId);
}

export function listPendingGithubApprovals() {
  return Array.from(pendingWriteApprovals.entries());
}
