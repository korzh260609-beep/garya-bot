// AGENT NOTE:
// SG 2.0 runtime AI tools.
// Purpose: let the AI model call approved runtime tools.

import { findCommitsByIntent } from "../agents/repo-commit-watcher-agent/repoCommitSearch.js";
import { runDiagnosticsCheck } from "../diagnostics/index.js";
import { runRenderEnvAgent } from "../agents/render-env-agent/renderEnvAgent.js";
import { runRepoRegistryAgent } from "../agents/repo-registry-agent/repoRegistryAgent.js";
import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";
import {
  applyCurrentProjectDefaults,
  applyCurrentProjectWriteDefaults,
  cancelPendingGithubApproval,
  executeGitHubApiRequest,
  executePendingGithubApproval,
  extractGithubApprovalId,
  getCurrentProjectBranch,
  getCurrentProjectRepository,
  isWriteMethod,
  jsonStringify,
  normalizeMethod,
  normalizePath,
  parseApprovalContext,
  parseJsonObject,
  prepareGithubWriteApproval,
} from "./github/index.js";

export { cancelPendingGithubApproval, executePendingGithubApproval, extractGithubApprovalId };

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

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

export async function renderCollectEnv(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "render_collect_env_not_allowed",
    };
  }

  return runRenderEnvAgent({
    target: typeof input.target === "string" && input.target.trim() ? input.target.trim() : "garya-bot",
  });
}

export async function repoCollectRegistry(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "repo_collect_registry_not_allowed",
    };
  }

  return runRepoRegistryAgent({
    repo: typeof input.repo === "string" && input.repo.trim() ? input.repo.trim() : undefined,
    branch: typeof input.branch === "string" && input.branch.trim() ? input.branch.trim() : undefined,
  });
}

export async function repoSearchCommits(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "repo_search_commits_not_allowed",
    };
  }

  return findCommitsByIntent({
    text: typeof input.text === "string" && input.text.trim() ? input.text.trim() : context.latestUserText,
    repo: typeof input.repo === "string" && input.repo.trim() ? input.repo.trim() : undefined,
    branch: typeof input.branch === "string" && input.branch.trim() ? input.branch.trim() : undefined,
    limit: input.limit,
  });
}

export async function repoCheckLatestWorkflowRun(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "repo_check_latest_workflow_run_not_allowed",
    };
  }

  const repo = normalizeText(input.repo) || getCurrentProjectRepository();
  const branch = normalizeText(input.branch) || getCurrentProjectBranch();
  const workflow = normalizeText(input.workflow) || "sg2-smoke.yml";

  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs`,
    query: {
      branch,
      per_page: 1,
    },
  });

  const latestRun = result?.formatted?.runs?.[0] || null;

  return {
    ok: Boolean(result.ok),
    type: "repo_latest_workflow_run_check",
    repo,
    branch,
    workflow,
    latestRun,
    latestStatus: latestRun?.status || null,
    latestConclusion: latestRun?.conclusion || null,
    latestHeadSha: latestRun?.commit_sha || null,
    githubOk: Boolean(result.ok),
    githubStatus: result.status,
    error: result.error || null,
  };
}

export async function sgDiagnosticsCheck(input = {}, context = {}) {
  return runDiagnosticsCheck(input, context);
}

export async function runGithubTool(name, args = {}, context = {}) {
  if (name === "github_request") return githubRequest(args, context);
  if (name === "render_collect_logs") return renderCollectLogs(args, context);
  if (name === "render_collect_env") return renderCollectEnv(args, context);
  if (name === "repo_collect_registry") return repoCollectRegistry(args, context);
  if (name === "repo_search_commits") return repoSearchCommits(args, context);
  if (name === "repo_check_latest_workflow_run") return repoCheckLatestWorkflowRun(args, context);
  if (name === "sg_diagnostics_check") return sgDiagnosticsCheck(args, context);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
