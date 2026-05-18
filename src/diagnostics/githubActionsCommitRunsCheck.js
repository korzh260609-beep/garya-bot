// src/diagnostics/githubActionsCommitRunsCheck.js
// SG 2.0 — GitHub Actions commit runs diagnostic check.
// Purpose: verify GitHub Actions evidence for an exact commit SHA, not only latest branch workflow state.
// Read-only. No GitHub writes, repo mutation, runtime writes, Telegram, AI, DB, raw logs, or secrets.

import { executeGitHubApiRequest } from "../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../tools/github/githubProjectDefaults.js";

export const GITHUB_ACTIONS_COMMIT_RUNS_CHECK_VERSION = 2;

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizePositiveInt(value, fallback = 100, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(max, Math.trunc(number)));
}

function normalizeRunIdSet(value) {
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.map((item) => normalizeText(item)).filter(Boolean));
}

function normalizeRun(run = {}) {
  return {
    id: Number(run.id || 0) || null,
    name: normalizeText(run.name),
    event: normalizeText(run.event),
    status: normalizeText(run.status),
    conclusion: run.conclusion === null || run.conclusion === undefined ? null : normalizeText(run.conclusion),
    workflowId: Number(run.workflow_id || run.workflowId || 0) || null,
    workflowName: normalizeText(run.display_title || run.workflow_name || run.name),
    headSha: normalizeText(run.head_sha || run.headSha || run.commit_sha),
    headBranch: normalizeText(run.head_branch || run.headBranch),
    htmlUrl: normalizeText(run.html_url || run.htmlUrl),
    createdAt: normalizeText(run.created_at || run.createdAt),
    updatedAt: normalizeText(run.updated_at || run.updatedAt),
  };
}

function summarizeRuns({ targetSha, runs, matchingRuns, ignoredRuns = [] }) {
  const ignoredSuffix = ignoredRuns.length ? ` Ignored ${ignoredRuns.length} current observation run(s).` : "";
  if (!targetSha) return "GitHub Actions commit runs check skipped: commit SHA missing.";
  if (!runs.length) return `GitHub Actions commit runs check found no runs for branch query while looking for ${targetSha.slice(0, 12)}.${ignoredSuffix}`;
  if (!matchingRuns.length) return `GitHub Actions commit runs check found ${runs.length} branch runs but none for commit ${targetSha.slice(0, 12)}.${ignoredSuffix}`;

  const completed = matchingRuns.filter((run) => run.status === "completed");
  const successful = matchingRuns.filter((run) => run.status === "completed" && run.conclusion === "success");
  const failed = matchingRuns.filter((run) => run.status === "completed" && run.conclusion && run.conclusion !== "success");
  const active = matchingRuns.filter((run) => run.status !== "completed");

  if (failed.length) {
    return `GitHub Actions commit runs found for ${targetSha.slice(0, 12)}: ${successful.length} success, ${failed.length} failed, ${active.length} active.${ignoredSuffix}`;
  }

  if (active.length) {
    return `GitHub Actions commit runs found for ${targetSha.slice(0, 12)}: ${successful.length} success, ${active.length} active.${ignoredSuffix}`;
  }

  return `GitHub Actions commit runs found for ${targetSha.slice(0, 12)}: ${successful.length}/${completed.length} completed successfully.${ignoredSuffix}`;
}

export function getGitHubActionsCommitRunsCheckBoundaries() {
  return {
    readOnly: true,
    verifiesExactCommitSha: true,
    usesGitHubActionsRunsApi: true,
    canIgnoreCurrentObservationRun: true,
    writesGitHub: false,
    writesRepository: false,
    writesRuntimeFiles: false,
    writesDatabase: false,
    touchesTelegram: false,
    callsAI: false,
    emitsRawLogs: false,
    emitsSecrets: false,
  };
}

export async function runGitHubActionsCommitRunsCheck({
  repo = getCurrentProjectRepository(),
  branch = getCurrentProjectBranch(),
  commitSha = "",
  perPage = 100,
  ignoredRunIds = [],
  currentRunId = "",
} = {}) {
  const safeRepo = normalizeText(repo);
  const safeBranch = normalizeText(branch);
  const safeCommitSha = normalizeText(commitSha);
  const safePerPage = normalizePositiveInt(perPage, 100, 100);
  const ignoredRunIdSet = normalizeRunIdSet([
    ...Array.from(normalizeRunIdSet(ignoredRunIds)),
    currentRunId,
  ]);

  if (!safeRepo) {
    return {
      ok: false,
      type: "github_actions_commit_runs_check",
      version: GITHUB_ACTIONS_COMMIT_RUNS_CHECK_VERSION,
      summary: "GitHub Actions commit runs check failed: repository missing.",
      reason: "repo_missing",
      boundaries: getGitHubActionsCommitRunsCheckBoundaries(),
      sanitized: true,
      readOnly: true,
    };
  }

  if (!safeCommitSha) {
    return {
      ok: false,
      type: "github_actions_commit_runs_check",
      version: GITHUB_ACTIONS_COMMIT_RUNS_CHECK_VERSION,
      repo: safeRepo,
      branch: safeBranch,
      commitSha: "",
      summary: "GitHub Actions commit runs check failed: commit SHA missing.",
      reason: "commit_sha_missing",
      boundaries: getGitHubActionsCommitRunsCheckBoundaries(),
      sanitized: true,
      readOnly: true,
    };
  }

  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${safeRepo}/actions/runs`,
    query: {
      branch: safeBranch || undefined,
      per_page: safePerPage,
    },
  });

  const rawRuns = Array.isArray(result?.data?.workflow_runs) ? result.data.workflow_runs : [];
  const runs = rawRuns.map(normalizeRun);
  const allMatchingRuns = runs.filter((run) => run.headSha === safeCommitSha);
  const ignoredRuns = allMatchingRuns.filter((run) => ignoredRunIdSet.has(String(run.id)));
  const matchingRuns = allMatchingRuns.filter((run) => !ignoredRunIdSet.has(String(run.id)));
  const activeRuns = matchingRuns.filter((run) => run.status !== "completed");
  const failedRuns = matchingRuns.filter((run) => run.status === "completed" && run.conclusion && run.conclusion !== "success");
  const successfulRuns = matchingRuns.filter((run) => run.status === "completed" && run.conclusion === "success");
  const ok = Boolean(result.ok) && matchingRuns.length > 0 && activeRuns.length === 0 && failedRuns.length === 0;

  return {
    ok,
    type: "github_actions_commit_runs_check",
    version: GITHUB_ACTIONS_COMMIT_RUNS_CHECK_VERSION,
    repo: safeRepo,
    branch: safeBranch,
    commitSha: safeCommitSha,
    githubOk: Boolean(result.ok),
    githubStatus: result.status || 0,
    runsChecked: runs.length,
    matchingRunsCount: matchingRuns.length,
    allMatchingRunsCount: allMatchingRuns.length,
    ignoredRunsCount: ignoredRuns.length,
    successfulRunsCount: successfulRuns.length,
    activeRunsCount: activeRuns.length,
    failedRunsCount: failedRuns.length,
    matchingRuns,
    ignoredRuns,
    summary: summarizeRuns({
      targetSha: safeCommitSha,
      runs,
      matchingRuns,
      ignoredRuns,
    }),
    reason: ok ? null : matchingRuns.length === 0
      ? "no_workflow_runs_for_commit_sha"
      : activeRuns.length > 0
        ? "workflow_runs_still_active"
        : failedRuns.length > 0
          ? "workflow_runs_failed"
          : result.ok ? null : "github_actions_runs_query_failed",
    error: result.error || null,
    boundaries: getGitHubActionsCommitRunsCheckBoundaries(),
    sanitized: true,
    readOnly: true,
  };
}

export default {
  GITHUB_ACTIONS_COMMIT_RUNS_CHECK_VERSION,
  getGitHubActionsCommitRunsCheckBoundaries,
  runGitHubActionsCommitRunsCheck,
};
