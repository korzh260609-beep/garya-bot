// AGENT NOTE:
// SG 2.0 Diagnostics Check Agent registry.
// Purpose: register bounded read-only diagnostics checks for the observation nervous system.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

import { findCommitsByIntent } from "../repo-commit-watcher-agent/repoCommitSearch.js";
import { runRenderEnvAgent } from "../render-env-agent/renderEnvAgent.js";
import { runRepoRegistryAgent } from "../repo-registry-agent/repoRegistryAgent.js";
import { runGetRenderLogsTask } from "../../tasks/render/getRenderLogsTask.js";
import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import { runObservationJournalStatusCheck } from "../../diagnostics/observationJournalStatusCheck.js";
import { runObservationLatestReportCheck } from "../../diagnostics/observationLatestReportCheck.js";
import { runProjectMemoryLiveDbCheck } from "../../diagnostics/projectMemoryLiveDbCheck.js";
import { runProjectMemoryRuntimeCheck } from "../../diagnostics/projectMemoryRuntimeCheck.js";
import { runUsersIdentityLinkingCheck } from "../../diagnostics/usersIdentityLinkingCheck.js";
import { runUsersIdentityLinkRequestsCheck } from "../../diagnostics/usersIdentityLinkRequestsCheck.js";
import { runUsersIdentityRegistryCheck } from "../../diagnostics/usersIdentityRegistryCheck.js";

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

function summarizeProjectMemoryLiveDb(result = {}) {
  if (!result.ok) return result.summary || "Project Memory live DB check failed.";
  return result.summary || "Project Memory live DB check passed.";
}

function summarizeProjectMemoryRuntime(result = {}) {
  if (!result.ok) return result.summary || "Project Memory runtime check failed.";
  return result.summary || "Project Memory runtime check passed.";
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

export const diagnosticsCheckRegistry = [
  {
    name: "users_identity_registry",
    run: () => runUsersIdentityRegistryCheck(),
    summarize: summarizeUsersIdentityRegistry,
  },
  {
    name: "users_identity_linking",
    run: () => runUsersIdentityLinkingCheck(),
    summarize: summarizeUsersIdentityLinking,
  },
  {
    name: "users_identity_link_requests",
    run: () => runUsersIdentityLinkRequestsCheck(),
    summarize: summarizeUsersIdentityLinkRequests,
  },
  {
    name: "project_memory_runtime",
    run: () => runProjectMemoryRuntimeCheck(),
    summarize: summarizeProjectMemoryRuntime,
  },
  {
    name: "project_memory_live_db",
    run: () => runProjectMemoryLiveDbCheck(),
    summarize: summarizeProjectMemoryLiveDb,
  },
  {
    name: "observation_latest_report",
    run: () => runObservationLatestReportCheck({ name: "diagnostics-latest" }),
    summarize: summarizeObservationLatestReport,
  },
  {
    name: "observation_journal_health_latest",
    run: () => runObservationLatestReportCheck({ name: "observation-journal-health-latest" }),
    summarize: summarizeObservationLatestReport,
  },
  {
    name: "observation_journal_status",
    run: () => runObservationJournalStatusCheck(),
    summarize: summarizeObservationJournalStatus,
  },
  {
    name: "render_logs",
    run: ({ logLimit, target }) => runGetRenderLogsTask({ limit: logLimit, target, level: "all" }),
    summarize: summarizeRenderLogs,
  },
  {
    name: "render_env_inventory",
    run: ({ target }) => runRenderEnvAgent({ target }),
    summarize: summarizeRenderEnv,
  },
  {
    name: "github_actions_latest_run",
    run: ({ repo, branch, workflow }) => checkLatestWorkflowRun({ repo, branch, workflow }),
    summarize: summarizeWorkflowRun,
  },
  {
    name: "repo_registry",
    run: ({ repo, branch }) => runRepoRegistryAgent({ repo, branch }),
    summarize: summarizeRepoRegistry,
  },
  {
    name: "recent_commits",
    run: ({ text, repo, branch }) => findCommitsByIntent({
      text: text || "diagnostics render deploy github actions registry",
      repo,
      branch,
      limit: 12,
    }),
    summarize: summarizeCommits,
  },
];

export default {
  diagnosticsCheckRegistry,
};
