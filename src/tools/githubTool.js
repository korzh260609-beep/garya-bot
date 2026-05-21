// AGENT NOTE:
// SG 2.0 runtime AI tools.
// Purpose: let the AI model call approved runtime tools.

import { findCommitsByIntent } from "../agents/repo-commit-watcher-agent/repoCommitSearch.js";
import { runDiagnosticsCheck } from "../diagnostics/index.js";
import { runRenderEnvAgent } from "../agents/render-env-agent/renderEnvAgent.js";
import { runRepoRegistryAgent } from "../agents/repo-registry-agent/repoRegistryAgent.js";
import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  runProjectMemoryRuntimeTrustedEventTool,
} from "../memory/index.js";
import { runProjectMemoryLatestRepoCommitProcessorTool } from "./projectMemoryLatestRepoCommitProcessorTool.js";
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

const PROJECT_MEMORY_DIAGNOSTICS_CHECKS = Object.freeze([
  "project_memory_runtime",
  "project_memory_live_db",
  "project_memory_counts",
  "project_memory_production_readiness",
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCheckList(value = []) {
  return Array.isArray(value)
    ? value.map((item) => normalizeText(item)).filter(Boolean)
    : [];
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildRuntimeToolActor(context = {}) {
  return {
    globalUserId: normalizeText(context.globalUserId),
    platform: context.transport || context.platform || "unknown",
    platformUserId: context.userId || context.platformUserId || null,
    role: context.isMonarch ? "monarch" : "system",
    isMonarch: Boolean(context.isMonarch),
  };
}

function buildProjectMemoryTrustedEventFinalText(result = {}) {
  return [
    "Project Memory trusted event processed.",
    `- ok: ${Boolean(result.ok)}`,
    `- dispatched: ${Boolean(result.dispatched)}`,
    `- stored: ${Boolean(result.stored)}`,
    `- confirmed: ${Boolean(result.confirmed)}`,
    `- requiresConfirmation: ${Boolean(result.requiresConfirmation)}`,
    `- traceId: ${result.traceId || "unknown"}`,
    `- sourceKind: ${result.trustedEventSourceResult?.sourceKind || "unknown"}`,
  ].join("\n");
}

function isProjectMemoryDiagnosticsToolRequest(input = {}, context = {}) {
  const text = normalizeLowerText(input.text || context.latestUserText);
  const checks = normalizeCheckList(input.checks);

  if (checks.some((check) => check.startsWith("project_memory_"))) return false;

  return Boolean(
    text.includes("project memory")
    && (
      text.includes("диагност")
      || text.includes("diagnostic")
      || text.includes("diagnose")
      || text.includes("check")
      || text.includes("проверь")
      || text.includes("провер")
    )
  );
}

function buildDiagnosticsToolInput(input = {}, context = {}) {
  if (!isProjectMemoryDiagnosticsToolRequest(input, context)) {
    return input;
  }

  return {
    ...input,
    text: normalizeText(input.text) || normalizeText(context.latestUserText),
    checks: PROJECT_MEMORY_DIAGNOSTICS_CHECKS,
  };
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

export async function projectMemoryRecordTrustedEvent(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "project_memory_record_trusted_event_not_allowed",
    };
  }

  const request = normalizePlainObject(input.request);
  const sourceKind = normalizeText(input.sourceKind || request.sourceKind)
    || PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED;
  const result = await runProjectMemoryRuntimeTrustedEventTool({
    request: {
      ...request,
      explicitRuntimeTrustedEventToolRequest: true,
      sourceKind,
      projectKey: normalizeText(input.projectKey || request.projectKey) || "sg",
      moduleKey: normalizeText(input.moduleKey || request.moduleKey) || "project_memory",
      stageKey: normalizeText(input.stageKey || request.stageKey) || "stage_07_memory",
      pr: normalizePlainObject(input.pr || request.pr),
      evidence: normalizePlainObject(input.evidence || input.renderEvidence || request.evidence || request.renderEvidence),
      tags: Array.isArray(input.tags) ? input.tags : Array.isArray(request.tags) ? request.tags : [],
      metadata: normalizePlainObject(input.metadata || request.metadata),
      traceId: normalizeText(input.traceId || request.traceId) || null,
    },
    actor: buildRuntimeToolActor(context),
    confirmation: input.confirmation || null,
    createdBy: normalizeText(input.createdBy) || "ai-tool-project-memory-record-trusted-event",
    traceId: normalizeText(input.traceId || request.traceId) || null,
  });

  return {
    ...result,
    type: "project_memory_record_trusted_event",
    finalText: buildProjectMemoryTrustedEventFinalText(result),
  };
}

export async function projectMemoryProcessLatestRepoCommit(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      error: "project_memory_process_latest_repo_commit_not_allowed",
    };
  }

  return runProjectMemoryLatestRepoCommitProcessorTool({ input, context });
}

export async function sgDiagnosticsCheck(input = {}, context = {}) {
  return runDiagnosticsCheck(buildDiagnosticsToolInput(input, context), context);
}

export async function runGithubTool(name, args = {}, context = {}) {
  if (name === "github_request") return githubRequest(args, context);
  if (name === "render_collect_logs") return renderCollectLogs(args, context);
  if (name === "render_collect_env") return renderCollectEnv(args, context);
  if (name === "repo_collect_registry") return repoCollectRegistry(args, context);
  if (name === "repo_search_commits") return repoSearchCommits(args, context);
  if (name === "repo_check_latest_workflow_run") return repoCheckLatestWorkflowRun(args, context);
  if (name === "project_memory_record_trusted_event") return projectMemoryRecordTrustedEvent(args, context);
  if (name === "project_memory_process_latest_repo_commit") return projectMemoryProcessLatestRepoCommit(args, context);
  if (name === "sg_diagnostics_check") return sgDiagnosticsCheck(args, context);

  return {
    ok: false,
    error: `Unknown GitHub tool: ${name}`,
  };
}

export function stringifyGithubToolResult(result) {
  return jsonStringify(result);
}
