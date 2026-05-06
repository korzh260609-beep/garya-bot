// AGENT NOTE:
// SG 2.0 message GitHub approval response helpers.
// Purpose: isolate approval id extraction and response shaping from handleMessage.

export function extractGithubApprovalIdFromReply(reply = "") {
  const match = String(reply || "").match(/\bSG-WRITE-[A-F0-9]{8,16}\b/i);
  return match ? match[0].toUpperCase() : null;
}

export function buildGithubApprovalPayload({ aiResult, reply }) {
  const githubApprovalId =
    aiResult?.metadata?.githubApproval?.approvalId || extractGithubApprovalIdFromReply(reply);

  return githubApprovalId
    ? {
        approvalId: githubApprovalId,
        requestHash: aiResult?.metadata?.githubApproval?.requestHash || null,
        summary: aiResult?.metadata?.githubApproval?.summary || null,
        expiresAt: aiResult?.metadata?.githubApproval?.expiresAt || null,
      }
    : null;
}

export function buildSuccessfulMessageReply({ aiResult, identity, behaviorRuntime }) {
  const reply = aiResult.text;

  return {
    ok: true,
    reply: aiResult?.metadata?.githubApproval?.warning || reply,
    identity,
    behaviorRuntime,
    githubApproval: buildGithubApprovalPayload({ aiResult, reply }),
  };
}
