// AGENT NOTE:
// SG 2.0 Project Memory latest repo commit processor runtime tool.
// Purpose: process the latest repo commit watcher state on Render/runtime, where DATABASE_URL exists.
// This tool reads only the bounded latest commit state from the runtime workspace,
// records a trusted Project Memory event for an unprocessed merge PR commit,
// and updates the bounded runtime state to prevent duplicate writes.
// Do not read raw chat, touch Telegram, call AI, expose secrets, or give GitHub Actions DB access here.

import workspaceChannel from "../runtime/workspace/workspaceChannel.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  runProjectMemoryRuntimeTrustedEventTool,
} from "../memory/index.js";

export const PROJECT_MEMORY_LATEST_REPO_COMMIT_PROCESSOR_TOOL_VERSION = 1;

const LATEST_COMMIT_STATE_PATH = "runtime/repo/latest/latest-commit-state.json";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function extractMergePrInfo(message = "") {
  const text = normalizeText(message);
  const firstLine = text.split("\n")[0] || "";
  const simpleMatch = firstLine.match(/^Merge PR #(\d+) into (.+)$/i);

  if (simpleMatch) {
    return {
      prNumber: Number(simpleMatch[1]),
      title: firstLine,
      baseBranch: normalizeText(simpleMatch[2]),
    };
  }

  const githubMatch = firstLine.match(/^Merge pull request #(\d+) from (.+)$/i);

  if (githubMatch) {
    return {
      prNumber: Number(githubMatch[1]),
      title: firstLine,
      baseBranch: "",
    };
  }

  return null;
}

function buildRuntimeToolActor(context = {}) {
  return {
    globalUserId: normalizeText(context.globalUserId) || "system:project-memory-latest-repo-commit-processor",
    platform: context.transport || context.platform || "runtime",
    platformUserId: context.userId || context.platformUserId || null,
    role: context.isMonarch ? "monarch" : "system",
    isMonarch: Boolean(context.isMonarch),
  };
}

function hasRecordedProjectMemoryEvent(state = {}) {
  if (state.project_memory_event_recorded === true) return true;

  const event = normalizePlainObject(state.project_memory_event);
  return Boolean(event.stored || event.confirmed);
}

function buildProjectMemoryEventSummary(result = {}, prInfo = {}, commit = {}) {
  return {
    ok: Boolean(result?.ok),
    type: "project_memory_latest_repo_commit_processor_event",
    skipped: false,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
    prNumber: prInfo.prNumber || null,
    stored: Boolean(result?.stored),
    confirmed: Boolean(result?.confirmed),
    requiresConfirmation: Boolean(result?.requiresConfirmation),
    traceId: result?.traceId || `pmtrace_repo_commit_${String(commit?.sha || "unknown").slice(0, 12)}`,
    reason: result?.reason || null,
  };
}

async function readLatestCommitState() {
  const existing = await workspaceChannel.readText(LATEST_COMMIT_STATE_PATH);
  return {
    sha: existing.sha || null,
    state: JSON.parse(existing.text || "{}"),
  };
}

export function buildProjectMemoryLatestRepoCommitProcessorToolStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryLatestRepoCommitProcessorTool",
    version: PROJECT_MEMORY_LATEST_REPO_COMMIT_PROCESSOR_TOOL_VERSION,
    transportIndependent: true,
    runtimeOnly: true,
    readsRuntimeLatestCommitState: true,
    writesRuntimeLatestCommitState: true,
    writesProjectMemoryThroughTrustedEventTool: true,
    callsAI: false,
    readsRawChat: false,
    touchesTelegram: false,
    grantsDatabaseAccessToGithubActions: false,
  };
}

export async function runProjectMemoryLatestRepoCommitProcessorTool({ input = {}, context = {} } = {}) {
  const { state } = await readLatestCommitState();
  const safeState = normalizePlainObject(state);
  const commit = normalizePlainObject(safeState.latest_commit);
  const prInfo = extractMergePrInfo(commit.message);

  if (!commit.sha) {
    return {
      ok: false,
      type: "project_memory_latest_repo_commit_processor",
      processed: false,
      skipped: true,
      reason: "latest_commit_missing",
      state_path: LATEST_COMMIT_STATE_PATH,
    };
  }

  if (!prInfo?.prNumber) {
    return {
      ok: true,
      type: "project_memory_latest_repo_commit_processor",
      processed: false,
      skipped: true,
      reason: "not_a_merge_pr_commit",
      state_path: LATEST_COMMIT_STATE_PATH,
      latestCommitSha: commit.sha,
    };
  }

  if (hasRecordedProjectMemoryEvent(safeState) && input.force !== true) {
    return {
      ok: true,
      type: "project_memory_latest_repo_commit_processor",
      processed: false,
      skipped: true,
      reason: "project_memory_event_already_recorded",
      state_path: LATEST_COMMIT_STATE_PATH,
      latestCommitSha: commit.sha,
      prNumber: prInfo.prNumber,
      project_memory_event: safeState.project_memory_event || null,
    };
  }

  const repo = normalizeText(safeState.repo);
  const branch = normalizeText(safeState.branch || prInfo.baseBranch);
  const traceId = `pmtrace_repo_commit_${String(commit.sha || "unknown").slice(0, 12)}`;

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
        sourceRef: repo ? `https://github.com/${repo}/pull/${prInfo.prNumber}` : "",
        repositoryFullName: repo,
        baseBranch: branch,
        headSha: commit.sha,
        mergedAt: normalizeText(commit.date) || new Date().toISOString(),
      },
      tags: ["repo_commit_watcher", "automatic_project_memory", "runtime_latest_commit_processor"],
      metadata: {
        source: "ProjectMemoryLatestRepoCommitProcessorTool",
        originalSource: "RepoCommitWatcherAgent",
        commitSha: commit.sha || null,
        commitShortSha: commit.short_sha || null,
        changedFilesCount: commit.changed_files_count || 0,
      },
      traceId,
    },
    actor: buildRuntimeToolActor(context),
    createdBy: "project-memory-latest-repo-commit-processor-tool",
    traceId,
  });

  const projectMemoryEvent = buildProjectMemoryEventSummary(result, prInfo, commit);
  const eventRecorded = Boolean(result?.ok && (result?.stored || result?.confirmed));
  const nextState = {
    ...safeState,
    generated_at: new Date().toISOString(),
    project_memory_event_recorded: eventRecorded,
    project_memory_event: projectMemoryEvent,
    project_memory_latest_repo_commit_processor: {
      ok: Boolean(result?.ok),
      processed_at: new Date().toISOString(),
      processor_version: PROJECT_MEMORY_LATEST_REPO_COMMIT_PROCESSOR_TOOL_VERSION,
      event_recorded: eventRecorded,
      traceId,
    },
  };

  const write = await workspaceChannel.writeJson(LATEST_COMMIT_STATE_PATH, nextState, {
    message: `project memory: process latest repo commit ${String(commit.sha || "unknown").slice(0, 12)}`,
  });

  return {
    ok: Boolean(result?.ok),
    type: "project_memory_latest_repo_commit_processor",
    processed: true,
    skipped: false,
    state_path: LATEST_COMMIT_STATE_PATH,
    latestCommitSha: commit.sha,
    prNumber: prInfo.prNumber,
    project_memory_event_recorded: eventRecorded,
    project_memory_event: projectMemoryEvent,
    trusted_event_result: result,
    write,
  };
}

export default {
  PROJECT_MEMORY_LATEST_REPO_COMMIT_PROCESSOR_TOOL_VERSION,
  buildProjectMemoryLatestRepoCommitProcessorToolStatus,
  runProjectMemoryLatestRepoCommitProcessorTool,
};
