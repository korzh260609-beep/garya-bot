// AGENT NOTE:
// SG 2.0 AI tool metadata helpers.
// Purpose: isolate metadata extraction from tool results without owning tool execution.
// Do not add approval policy, GitHub request execution, or transport formatting here.

export function extractToolMetadata(toolName, result) {
  const metadata = {};

  if (typeof result?.finalText === "string" && result.finalText.trim()) {
    metadata.finalText = result.finalText.trim();
    metadata.finalTextSource = toolName;
  }

  if (toolName === "github_request" && result?.requires_approval && result?.approval_id && !result?.executed) {
    metadata.githubApproval = {
      approvalId: result.approval_id,
      requestHash: result.request_hash || null,
      summary: result.summary || null,
      warning: result.warning || null,
      expiresAt: result.expires_at || null,
    };
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

export function mergeMetadata(base = {}, patch = null) {
  if (!patch || typeof patch !== "object") return base;

  return {
    ...base,
    ...patch,
  };
}
