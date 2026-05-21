// AGENT NOTE:
// SG 2.0 Project Memory latest repo commit candidate confirmation runtime tool.
// Purpose: confirm the pending Project Memory candidate created from the latest repo commit processor.
// This tool reads only bounded runtime state, finds the pending candidate by traceId in Project Memory DB,
// confirms it through the existing explicit confirmation boundary, and updates bounded runtime state.
// Do not read raw chat, touch Telegram, call AI, expose secrets, or grant GitHub Actions DB access here.

import workspaceChannel from "../runtime/workspace/workspaceChannel.js";
import { queryPostgres } from "../db/postgresClient.js";
import { ProjectMemoryConfirmation } from "../memory/index.js";

export const PROJECT_MEMORY_CONFIRM_LATEST_REPO_COMMIT_CANDIDATE_TOOL_VERSION = 1;

const LATEST_COMMIT_STATE_PATH = "runtime/repo/latest/latest-commit-state.json";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildRuntimeToolActor(context = {}) {
  return {
    globalUserId: normalizeText(context.globalUserId) || "system:project-memory-confirm-latest-repo-commit-candidate",
    platform: context.transport || context.platform || "runtime",
    platformUserId: context.userId || context.platformUserId || null,
    role: context.isMonarch ? "monarch" : "system",
    isMonarch: Boolean(context.isMonarch),
  };
}

function buildActorRef(actor = {}) {
  if (actor.globalUserId) return actor.globalUserId;
  if (actor.platformUserId) return `${actor.platform || "unknown"}:${actor.platformUserId}`;
  return actor.role || "system";
}

async function readLatestCommitState() {
  const existing = await workspaceChannel.readText(LATEST_COMMIT_STATE_PATH);
  return {
    sha: existing.sha || null,
    state: JSON.parse(existing.text || "{}"),
  };
}

async function findPendingCandidateByTraceId(traceId) {
  const safeTraceId = normalizeText(traceId);

  if (!safeTraceId) {
    return {
      ok: false,
      reason: "missing_trace_id",
      entry: null,
    };
  }

  const result = await queryPostgres(
    `SELECT * FROM sg_project_memory_entries
     WHERE trace_id = $1 AND trust = 'candidate' AND status = 'pending_confirmation'
     ORDER BY created_at DESC
     LIMIT 1`,
    [safeTraceId],
  );

  if (!result.ok) return result;

  if (!result.rowCount) {
    return {
      ok: false,
      reason: "pending_candidate_not_found_for_trace_id",
      entry: null,
      traceId: safeTraceId,
    };
  }

  return {
    ok: true,
    entry: result.rows?.[0] || null,
    traceId: safeTraceId,
  };
}

export function buildProjectMemoryConfirmLatestRepoCommitCandidateToolStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryConfirmLatestRepoCommitCandidateTool",
    version: PROJECT_MEMORY_CONFIRM_LATEST_REPO_COMMIT_CANDIDATE_TOOL_VERSION,
    transportIndependent: true,
    runtimeOnly: true,
    readsRuntimeLatestCommitState: true,
    confirmsProjectMemoryThroughExplicitConfirmationBoundary: true,
    writesRuntimeLatestCommitState: true,
    callsAI: false,
    readsRawChat: false,
    touchesTelegram: false,
    grantsDatabaseAccessToGithubActions: false,
  };
}

export async function runProjectMemoryConfirmLatestRepoCommitCandidateTool({ input = {}, context = {} } = {}) {
  const { state } = await readLatestCommitState();
  const safeState = normalizePlainObject(state);
  const projectMemoryEvent = normalizePlainObject(safeState.project_memory_event);
  const traceId = normalizeText(input.traceId || projectMemoryEvent.traceId || safeState.project_memory_latest_repo_commit_processor?.traceId);
  const actor = buildRuntimeToolActor(context);

  if (projectMemoryEvent.confirmed === true) {
    return {
      ok: true,
      type: "project_memory_confirm_latest_repo_commit_candidate",
      confirmed: true,
      skipped: true,
      reason: "project_memory_event_already_confirmed",
      state_path: LATEST_COMMIT_STATE_PATH,
      traceId,
    };
  }

  const pending = await findPendingCandidateByTraceId(traceId);
  if (!pending.ok) {
    return {
      ok: false,
      type: "project_memory_confirm_latest_repo_commit_candidate",
      confirmed: false,
      skipped: false,
      reason: pending.reason || "pending_candidate_lookup_failed",
      state_path: LATEST_COMMIT_STATE_PATH,
      traceId,
      lookup: pending,
    };
  }

  const entryId = normalizeText(pending.entry?.id);
  const confirmation = new ProjectMemoryConfirmation();
  const result = await confirmation.confirmCandidate({
    entryId,
    confirmedBy: buildActorRef(actor),
    traceId,
    approvalRef: normalizeText(input.approvalRef) || "monarch_latest_repo_commit_confirmation",
  });

  const confirmed = Boolean(result?.ok && result?.entry);
  const nextState = {
    ...safeState,
    generated_at: new Date().toISOString(),
    project_memory_event_recorded: true,
    project_memory_event: {
      ...projectMemoryEvent,
      ok: Boolean(projectMemoryEvent.ok || confirmed),
      stored: Boolean(projectMemoryEvent.stored || confirmed),
      confirmed,
      requiresConfirmation: !confirmed,
      entryId,
      traceId,
      reason: result?.reason || null,
    },
    project_memory_latest_repo_commit_confirmation: {
      ok: Boolean(result?.ok),
      confirmed,
      confirmed_at: new Date().toISOString(),
      confirmation_version: PROJECT_MEMORY_CONFIRM_LATEST_REPO_COMMIT_CANDIDATE_TOOL_VERSION,
      entryId,
      traceId,
      reason: result?.reason || null,
    },
  };

  const write = await workspaceChannel.writeJson(LATEST_COMMIT_STATE_PATH, nextState, {
    message: `project memory: confirm latest repo commit candidate ${traceId || "unknown"}`,
  });

  return {
    ok: Boolean(result?.ok),
    type: "project_memory_confirm_latest_repo_commit_candidate",
    confirmed,
    skipped: false,
    state_path: LATEST_COMMIT_STATE_PATH,
    entryId,
    traceId,
    confirmation: result,
    write,
  };
}

export default {
  PROJECT_MEMORY_CONFIRM_LATEST_REPO_COMMIT_CANDIDATE_TOOL_VERSION,
  buildProjectMemoryConfirmLatestRepoCommitCandidateToolStatus,
  runProjectMemoryConfirmLatestRepoCommitCandidateTool,
};
