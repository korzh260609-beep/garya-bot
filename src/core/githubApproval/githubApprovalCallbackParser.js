// AGENT NOTE:
// SG 2.0 GitHub approval callback parser.
// Purpose: isolate callback_data parsing for GitHub write approvals.
// Do not change the callback_data format without explicit Monarch approval.

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
