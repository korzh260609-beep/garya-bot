// AGENT NOTE:
// SG 2.0 runtime AI tools.
// Purpose: let the AI model call approved runtime tools.

import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";
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

function clampRenderLogLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
}

export async function renderCollectLogs(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "render_collect_logs_not_allowed",
    };
  }

  return runGetRenderLogsTask({
    limit: clampRenderLogLimit(input.limit, 100),
    target: typeof input.target === "string" && input.target.trim() ? input.target.trim() : "garya-bot",
    level: typeof input.level === "string" && input.level.trim() ? input.level.trim() : "all",
  });
}

export async function runGithubTool(name, args = {}, context = {}) {
  if (name === "github_request") return githubRequest(args, context);
  if (name === "render_collect_logs") return renderCollectLogs(args, context);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
