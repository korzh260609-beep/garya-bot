// src/agents/observation/repoCommitObservationBridge.js
// SG 2.0 — Repo Commit Observation bridge.
// Purpose: produce a sanitized latest-only Observation report from RepoCommitWatcherAgent state.
// Do not add Telegram integration, AI calls, memory writes, raw secrets, autonomous timers, or provider-specific mutation here.

import {
  createObservationEvent,
  OBSERVATION_ACTOR_ROLES,
  OBSERVATION_DIRECTIONS,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "./eventSchema.js";
import { writeObservationLatestReport } from "./observationWriter.js";

export const REPO_COMMIT_OBSERVATION_EVENT_TYPE = "repo.commit_observed";
export const REPO_COMMIT_OBSERVATION_REPORT_NAME = "repo-commit-latest";

function normalizeText(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizeBoolean(value) {
  return Boolean(value);
}

function normalizeChangedFiles(files = []) {
  if (!Array.isArray(files)) return [];

  return files.map((file) => ({
    filename: normalizeText(file?.filename),
    status: normalizeText(file?.status) || "modified",
    additions: Number(file?.additions || 0),
    deletions: Number(file?.deletions || 0),
    changes: Number(file?.changes || 0),
  })).filter((file) => file.filename);
}

export function buildRepoCommitObservationEvent(state = {}) {
  const commit = state.latest_commit || {};
  const changedFiles = normalizeChangedFiles(commit.changed_files);
  const shortSha = normalizeText(commit.short_sha || state.current_head_sha?.slice?.(0, 12));
  const message = normalizeText(commit.message);
  const hasNewCommit = normalizeBoolean(state.has_new_commit);
  const summary = hasNewCommit
    ? `Repo commit observed: ${shortSha} — ${message}`
    : `Repo commit unchanged: ${shortSha} — ${message}`;

  return createObservationEvent({
    event_type: REPO_COMMIT_OBSERVATION_EVENT_TYPE,
    source: {
      system: "sg",
      transport: "internal",
      module: "repo-commit-watcher",
    },
    actor: {
      role: OBSERVATION_ACTOR_ROLES.SYSTEM,
      user_ref: "redacted",
      chat_ref: "redacted",
    },
    direction: OBSERVATION_DIRECTIONS.INTERNAL,
    summary,
    payload: {
      repo: normalizeText(state.repo),
      branch: normalizeText(state.branch),
      current_head_sha: normalizeText(state.current_head_sha),
      previous_head_sha: normalizeText(state.previous_head_sha),
      has_new_commit: hasNewCommit,
      registry_updated: normalizeBoolean(state.registry_updated),
      registry_commit_sha: normalizeText(state.registry_commit_sha),
      latest_commit: {
        sha: normalizeText(commit.sha),
        short_sha: shortSha,
        message,
        author: normalizeText(commit.author),
        date: normalizeText(commit.date),
        html_url: normalizeText(commit.html_url),
        changed_files_count: Number(commit.changed_files_count || changedFiles.length),
        changed_files: changedFiles,
      },
    },
    policy: {
      sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
      retention: OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: true,
      memory_candidate: false,
    },
    links: {
      runtime_report_path: "runtime/repo/latest/latest-commit-state.json",
      related_commit_sha: normalizeText(state.current_head_sha),
      related_run_id: "",
    },
  });
}

export async function produceRepoCommitObservationLatest(state = {}) {
  const event = buildRepoCommitObservationEvent(state);

  return writeObservationLatestReport({
    name: REPO_COMMIT_OBSERVATION_REPORT_NAME,
    events: [event],
    summary: event.summary,
  });
}

export default {
  REPO_COMMIT_OBSERVATION_EVENT_TYPE,
  REPO_COMMIT_OBSERVATION_REPORT_NAME,
  buildRepoCommitObservationEvent,
  produceRepoCommitObservationLatest,
};
