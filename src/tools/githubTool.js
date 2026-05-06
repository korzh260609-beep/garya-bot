// AGENT NOTE:
// SG 2.0 free GitHub gateway tool.
// Purpose: let the AI model call GitHub REST API through SG runtime GitHub App authentication.
// This is intentionally a universal GitHub request gateway, not a set of narrow repo helpers.
// Secret auth values must never be returned to the model, logs, Telegram, or tool payloads.

import {
  applyCurrentProjectDefaults,
  applyCurrentProjectWriteDefaults,
  cancelPendingGithubApproval,
  executeGitHubApiRequest,
  executePendingGithubApproval,
  extractGithubApprovalId,
  getCurrentProjectBranch,
  isWriteMethod,
  jsonStringify,
  normalizeMethod,
  normalizePath,
  parseApprovalContext,
  parseJsonObject,
  prepareGithubWriteApproval,
} from "./github/index.js";

export { cancelPendingGithubApproval, executePendingGithubApproval, extractGithubApprovalId };

export async function githubRequest(input = {}, context = {}) {
  const normalizedMethod = normalizeMethod(input.method);
  const normalizedPath = normalizePath(input.path);
  const parsedQuery = parseJsonObject(input.queryJson ?? input.query, {});
  const query = applyCurrentProjectDefaults({
    method: normalizedMethod,
    path: normalizedPath,
    query: parsedQuery,
  });
  const parsedBody = parseJsonObject(input.bodyJson ?? input.body, null);
  const body = applyCurrentProjectWriteDefaults({
    method: normalizedMethod,
    path: normalizedPath,
    body: parsedBody,
  });
  const headers = parseJsonObject(input.headersJson ?? input.headers, {});
  const approvalContext = parseApprovalContext(input.approvalContextJson ?? input.approvalContext);

  if (!normalizedPath) {
    return {
      ok: false,
      error: "GitHub request path is required.",
    };
  }

  if (isWriteMethod(normalizedMethod)) {
    const approvalIdFromText = extractGithubApprovalId(context.latestUserText);

    if (approvalIdFromText) {
      return executePendingGithubApproval(approvalIdFromText, context);
    }

    return prepareGithubWriteApproval(
      {
        method: normalizedMethod,
        path: normalizedPath,
        query,
        body,
        headers,
        approvalContext,
        currentBranch: getCurrentProjectBranch(),
      },
      context
    );
  }

  return executeGitHubApiRequest({
    method: normalizedMethod,
    path: normalizedPath,
    query,
    body,
    headers,
  });
}

export async function runGithubTool(name, args = {}, context = {}) {
  if (name === "github_request") return githubRequest(args, context);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
