// AGENT NOTE:
// SG 2.0 Diagnostics checks runner.
// Purpose: execute bounded read-only diagnostics checks outside the public diagnostics orchestration entry point.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or code/env mutations here.

import { findCommitsByIntent } from "../agents/repo-commit-watcher-agent/repoCommitSearch.js";
import { runRenderEnvAgent } from "../agents/render-env-agent/renderEnvAgent.js";
import { runRepoRegistryAgent } from "../agents/repo-registry-agent/repoRegistryAgent.js";
import { runGetRenderLogsTask } from "../tasks/render/getRenderLogsTask.js";
import { executeGitHubApiRequest } from "../tools/github/githubApiClient.js";
import { runObservationJournalStatusCheck } from "./observationJournalStatusCheck.js";
import { runObservationLatestReportCheck } from "./observationLatestReportCheck.js";
import { runUsersIdentityLinkingCheck } from "./usersIdentityLinkingCheck.js";
import { runUsersIdentityLinkRequestsCheck } from "./usersIdentityLinkRequestsCheck.js";
import { runUsersIdentityRegistryCheck } from "./usersIdentityRegistryCheck.js";

function summarizeRenderLogs(result = {}) {
  if (!result.ok) return result.error || "Render logs check failed.";
  return `Render logs collected: ${result.logs_count ?? "unknown"} entries, path: ${result.path || "unknown"}.`;
}

function summarizeRenderEnv(result = {}) {
  if (!result.ok) return result.error || "Render env check failed.";
  return `Render env inventory collected: ${result.env_count ?? "unknown"} variables, path: ${result.path || "unknown"}.`;
}

function summarizeRepoRegistry(result = {}) {
  if (!result.ok) return result.error || "Repo registry check failed.";
  return `Repo registry collected: ${result.items_count ?? "unknown"} items, branch: ${result.branch || "unknown"}, path: ${result.path || "unknown"}.`;
}

function summarizeWorkflowRun(result = {}) {
  if (!result.ok) return result.error || "GitHub Actions check failed.";
  const run = result.latestRun;
  if (!run) return "GitHub Actions check completed, but no workflow run was found.";
  return `GitHub Actions latest run: ${run.name || result.workflow || "workflow"}, status=${run.status || "unknown"}, conclusion=${run.conclusion || "unknown"}.`;
}

function summarizeCommits(result = {}) {
  if (!result.ok) return result.error || "Recent commits check failed.";
  return result.summary?.text || `Recent commits checked: ${result.searched_commits ?? "unknown"}.`;
}

function summarizeObservationLatestReport(result = {}) {
  if (!result.ok) return result.error || result.summary || "Observation latest report check failed.";
  return result.summary || "Observation latest report check passed.";
}

function summarizeObservationJournalStatus(result = {}) {
  if (!result.ok) return result.error || result.summary || "Observation journal status check failed.";
  return result.summary || "Observation journal status check passed.";
}

function summarizeUsersIdentityRegistry(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity registry check failed.";
  return result.summary || "Users identity registry check passed.";
}

function summarizeUsersIdentityLinking(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity linking check failed.";
  return result.summary || "Users identity linking check passed.";
}

function summarizeUsersIdentityLinkRequests(result = {}) {
  if (!result.ok) return result.error || result.summary || "Users identity link requests check failed.";
  return result.summary || "Users identity link requests check passed.";
}

async function safeCheck(type, fn, summarize) {
  try {
    const data = await fn();
    return {
      ok: Boolean(data?.ok),
      type,
      summary: summarize(data),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      type,
      summary: error?.message || `${type}_failed`,
      error: error?.message || `${type}_failed`,
    };
  }
}

async function checkLatestWorkflowRun({ repo, branch, workflow }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs`,
    query: {
      branch,
      per_page: 1,
    },
  });

  const latestRun = result?.formatted?.runs?.[0] || result?.data?.workflow_runs?.[0] || null;

  return {
    ok: Boolean(result.ok),
    type: "repo_latest_workflow_run_check",
    repo,
    branch,
    workflow,
    latestRun,
    latestStatus: latestRun?.status || null,
    latestConclusion: latestRun?.conclusion || null,
    latestHeadSha: latestRun?.commit_sha || latestRun?.head_sha || null,
    githubOk: Boolean(result.ok),
    githubStatus: result.status,
    error: result.error || null,
  };
}

export async function runDiagnosticsChecks(input = {}) {
  const checks = Array.isArray(input.checks) ? input.checks : [];
  const text = typeof input.text === "string" ? input.text : "";
  const repo = typeof input.repo === "string" ? input.repo : "";
  const branch = typeof input.branch === "string" ? input.branch : "";
  const target = typeof input.target === "string" ? input.target : "";
  const workflow = typeof input.workflow === "string" ? input.workflow : "";
  const logLimit = input.logLimit;

  const results = [];

  if (checks.includes("users_identity_registry")) {
    results.push(await safeCheck(
      "users_identity_registry",
      () => runUsersIdentityRegistryCheck(),
      summarizeUsersIdentityRegistry
    ));
  }

  if (checks.includes("users_identity_linking")) {
    results.push(await safeCheck(
      "users_identity_linking",
      () => runUsersIdentityLinkingCheck(),
      summarizeUsersIdentityLinking
    ));
  }

  if (checks.includes("users_identity_link_requests")) {
    results.push(await safeCheck(
      "users_identity_link_requests",
      () => runUsersIdentityLinkRequestsCheck(),
      summarizeUsersIdentityLinkRequests
    ));
  }

  if (checks.includes("observation_latest_report")) {
    results.push(await safeCheck(
      "observation_latest_report",
      () => runObservationLatestReportCheck({ name: "diagnostics-latest" }),
      summarizeObservationLatestReport
    ));
  }

  if (checks.includes("observation_journal_status")) {
    results.push(await safeCheck(
      "observation_journal_status",
      () => runObservationJournalStatusCheck(),
      summarizeObservationJournalStatus
    ));
  }

  if (checks.includes("render_logs")) {
    results.push(await safeCheck(
      "render_logs",
      () => runGetRenderLogsTask({ limit: logLimit, target, level: "all" }),
      summarizeRenderLogs
    ));
  }

  if (checks.includes("render_env_inventory")) {
    results.push(await safeCheck(
      "render_env_inventory",
      () => runRenderEnvAgent({ target }),
      summarizeRenderEnv
    ));
  }

  if (checks.includes("github_actions_latest_run")) {
    results.push(await safeCheck(
      "github_actions_latest_run",
      () => checkLatestWorkflowRun({ repo, branch, workflow }),
      summarizeWorkflowRun
    ));
  }

  if (checks.includes("repo_registry")) {
    results.push(await safeCheck(
      "repo_registry",
      () => runRepoRegistryAgent({ repo, branch }),
      summarizeRepoRegistry
    ));
  }

  if (checks.includes("recent_commits")) {
    results.push(await safeCheck(
      "recent_commits",
      () => findCommitsByIntent({
        text: text || "diagnostics render deploy github actions registry",
        repo,
        branch,
        limit: 12,
      }),
      summarizeCommits
    ));
  }

  return results;
}

export default {
  runDiagnosticsChecks,
};
