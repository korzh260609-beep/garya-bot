// AGENT NOTE:
// RepoCommitWatcherAgent simple watcher.
// Purpose: detect a new branch HEAD commit, update minimal runtime state, trigger RepoRegistryAgent,
// and record bounded Project Memory trusted events for new merge commits.
// Do not store full commit history here. GitHub remains the source of truth.
// Do not read raw chat, touch Telegram, call AI, or store raw logs here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  runProjectMemoryRuntimeTrustedEventTool,
} from "../../memory/index.js";
import { runRepoRegistryAgent } from "../repo-registry-agent/repoRegistryAgent.js";

const LATEST_COMMIT_STATE_PATH = "runtime/repo/latest/latest-commit-state.json";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function extractMergePrInfo(message = "") {
  const text = normalizeString(message);
  const firstLine = text.split("\n")[0] || "";
  const match = firstLine.match(/^Merge PR #(\d+) into (.+)$/i);

  if (!match) return null;

  return {
    prNumber: Number(match[1]),
    title: firstLine,
    baseBranch: normalizeString(match[2]),
  };
}

async function recordProjectMemoryForNewMergeCommit({ repo, branch, commit } = {}) {
  const prInfo = extractMergePrInfo(commit?.message);

  if (!prInfo?.prNumber) {
    return {
      ok: true,
      type: "project_memory_auto_repo_commit_event",
      skipped: true,
      reason: "not_a_merge_pr_commit",
    };
  }

  const result = await runProjectMemoryRuntimeTrustedEventTool({
    request: {
      explicitRuntimeTrustedEventToolRequest: true,
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      projectKey: "sg",
      moduleKey: "project_memory",
      stageKey: "stage_07_memory",
      pr: {
        number: prInfo.prNumber,
        title: prInfo.title,
        sourceRef: `https://github.com/${repo}/pull/${prInfo.prNumber}`,
        repositoryFullName: repo,
        baseBranch: branch || prInfo.baseBranch,
        headSha: commit?.sha || "",
        mergedAt: commit?.date || new Date().toISOString(),
      },
      tags: ["repo_commit_watcher", "automatic_project_memory"],
      metadata: {
        source: "RepoCommitWatcherAgent",
        commitSha: commit?.sha || null,
        commitShortSha: commit?.short_sha || null,
        changedFilesCount: commit?.changed_files_count || 0,
      },
      traceId: `pmtrace_repo_commit_${String(commit?.sha || "unknown").slice(0, 12)}`,
    },
    actor: {
      role: "system",
      isMonarch: false,
      platform: "github",
      platformUserId: null,
      globalUserId: "system:repo-commit-watcher",
    },
    createdBy: "repo-commit-watcher-agent",
    traceId: `pmtrace_repo_commit_${String(commit?.sha || "unknown").slice(0, 12)}`,
  });

  return {
    ok: Boolean(result?.ok),
    type: "project_memory_auto_repo_commit_event",
    skipped: false,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
    prNumber: prInfo.prNumber,
    stored: Boolean(result?.stored),
    confirmed: Boolean(result?.confirmed),
    requiresConfirmation: Boolean(result?.requiresConfirmation),
    traceId: result?.traceId || null,
    reason: result?.reason || null,
  };
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

  let projectMemory = null;
  if (hasNewCommit) {
    projectMemory = await recordProjectMemoryForNewMergeCommit({
      repo: safeRepo,
      branch: safeBranch,
      commit,
    });
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
    project_memory_event_recorded: Boolean(projectMemory?.ok && !projectMemory.skipped),
    project_memory_event: projectMemory,
    latest_commit: commit,
  };

  const write = await writeLatestCommitState(state);

  return {
    ok: true,
    type: "repo_commit_watcher_agent",
    repo: safeRepo,
    branch: safeBranch,
    current_head_sha: head.sha,
    previous_head_sha: previousSha || null,
    has_new_commit: hasNewCommit,
    registry_updated: Boolean(registry?.ok),
    project_memory_event_recorded: Boolean(projectMemory?.ok && !projectMemory.skipped),
    project_memory_event: projectMemory,
    registry,
    state_path: LATEST_COMMIT_STATE_PATH,
    write,
  };
}

export default {
  runRepoCommitWatcherAgent,
};
