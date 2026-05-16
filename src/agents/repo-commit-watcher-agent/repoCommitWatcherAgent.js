// AGENT NOTE:
// RepoCommitWatcherAgent simple watcher.
// Purpose: detect a new branch HEAD commit, update minimal runtime state, trigger RepoRegistryAgent,
// and emit a sanitized latest-only Observation report for the observed commit.
// Do not store full commit history here. GitHub remains the source of truth.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";
import { produceRepoCommitObservationLatest } from "../observation/repoCommitObservationBridge.js";
import { runRepoRegistryAgent } from "../repo-registry-agent/repoRegistryAgent.js";

const LATEST_COMMIT_STATE_PATH = "runtime/repo/latest/latest-commit-state.json";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getBranchHead({ repo, branch }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
  });

  if (!result.ok) {
    throw new Error(`repo_commit_watcher_ref_failed:${result.status}:${result.error || "unknown"}`);
  }

  return {
    sha: normalizeString(result.data?.object?.sha),
    ref: normalizeString(result.data?.ref),
  };
}

async function getCommitSummary({ repo, sha }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/commits/${encodeURIComponent(sha)}`,
  });

  if (!result.ok) {
    throw new Error(`repo_commit_watcher_commit_failed:${result.status}:${result.error || "unknown"}`);
  }

  const data = result.data || {};
  const files = Array.isArray(data.files) ? data.files : [];

  return {
    sha,
    short_sha: sha.slice(0, 12),
    message: normalizeString(data?.commit?.message),
    author: normalizeString(data?.author?.login || data?.commit?.author?.name),
    date: normalizeString(data?.commit?.author?.date || data?.commit?.committer?.date),
    html_url: normalizeString(data?.html_url),
    changed_files_count: files.length,
    changed_files: files.map((file) => ({
      filename: file?.filename || "",
      status: file?.status || "modified",
      additions: Number(file?.additions || 0),
      deletions: Number(file?.deletions || 0),
      changes: Number(file?.changes || 0),
    })),
  };
}

async function readLatestCommitState() {
  try {
    const existing = await workspaceChannel.readText(LATEST_COMMIT_STATE_PATH);
    return JSON.parse(existing.text || "{}");
  } catch {
    return null;
  }
}

async function writeLatestCommitState(data) {
  return workspaceChannel.writeJson(LATEST_COMMIT_STATE_PATH, data, {
    message: `repo commit watcher: update latest ${data?.current_head_sha?.slice(0, 12) || "unknown"}`,
  });
}

export async function runRepoCommitWatcherAgent({ repo, branch, forceRegistryUpdate = false } = {}) {
  const safeRepo = normalizeString(repo || getCurrentProjectRepository());
  const safeBranch = normalizeString(branch || getCurrentProjectBranch());

  if (!safeRepo) throw new Error("repo_commit_watcher_repo_missing");
  if (!safeBranch) throw new Error("repo_commit_watcher_branch_missing");

  const previousState = await readLatestCommitState();
  const head = await getBranchHead({ repo: safeRepo, branch: safeBranch });

  if (!head.sha) throw new Error("repo_commit_watcher_head_sha_missing");

  const previousSha = normalizeString(previousState?.current_head_sha || previousState?.last_seen_sha);
  const hasNewCommit = previousSha !== head.sha;
  const shouldUpdateRegistry = hasNewCommit || Boolean(forceRegistryUpdate);
  const commit = await getCommitSummary({ repo: safeRepo, sha: head.sha });

  let registry = null;
  if (shouldUpdateRegistry) {
    registry = await runRepoRegistryAgent({ repo: safeRepo, branch: safeBranch });
  }

  const state = {
    ok: true,
    type: "repo_commit_state",
    generated_at: new Date().toISOString(),
    repo: safeRepo,
    branch: safeBranch,
    current_head_sha: head.sha,
    previous_head_sha: previousSha || null,
    has_new_commit: hasNewCommit,
    registry_updated: Boolean(registry?.ok),
    registry_commit_sha: registry?.write?.commit || null,
    latest_commit: commit,
  };

  const write = await writeLatestCommitState(state);
  const observation = await produceRepoCommitObservationLatest(state);

  return {
    ok: true,
    type: "repo_commit_watcher_agent",
    repo: safeRepo,
    branch: safeBranch,
    current_head_sha: head.sha,
    previous_head_sha: previousSha || null,
    has_new_commit: hasNewCommit,
    registry_updated: Boolean(registry?.ok),
    registry,
    observation,
    state_path: LATEST_COMMIT_STATE_PATH,
    observation_path: observation?.path || null,
    write,
  };
}

export default {
  runRepoCommitWatcherAgent,
};
