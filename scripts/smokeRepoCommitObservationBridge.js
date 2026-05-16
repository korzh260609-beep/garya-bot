// scripts/smokeRepoCommitObservationBridge.js
// SG 2.0 — Repo Commit Observation bridge smoke.
// Deterministic/offline: no GitHub API, no DB, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  buildRepoCommitObservationEvent,
  REPO_COMMIT_OBSERVATION_EVENT_TYPE,
  REPO_COMMIT_OBSERVATION_REPORT_NAME,
} from "../src/agents/observation/repoCommitObservationBridge.js";

const state = {
  ok: true,
  type: "repo_commit_state",
  generated_at: "2026-05-16T06:38:17.238Z",
  repo: "korzh260609-beep/garya-bot",
  branch: "dev/v2-start",
  current_head_sha: "8d7bbafda63d3157f1aca0b0f395cce2157cbaf8",
  previous_head_sha: "f40983491b0292eb3efe7a570fcf3a6e92a023c0",
  has_new_commit: true,
  registry_updated: true,
  registry_commit_sha: "605ca66dcc2af93d34c6dbc5f77d543986a45f11",
  latest_commit: {
    sha: "8d7bbafda63d3157f1aca0b0f395cce2157cbaf8",
    short_sha: "8d7bbafda63d",
    message: "render env: update latest 94",
    author: "sg-github-access[bot]",
    date: "2026-05-16T06:37:58Z",
    html_url: "https://github.com/korzh260609-beep/garya-bot/commit/8d7bbafda63d3157f1aca0b0f395cce2157cbaf8",
    changed_files_count: 1,
    changed_files: [
      {
        filename: "runtime/render/latest/latest-render-env.json",
        status: "modified",
        additions: 28,
        deletions: 4,
        changes: 32,
      },
    ],
  },
};

const event = buildRepoCommitObservationEvent(state);

assert.equal(REPO_COMMIT_OBSERVATION_REPORT_NAME, "repo-commit-latest");
assert.equal(event.event_type, REPO_COMMIT_OBSERVATION_EVENT_TYPE);
assert.equal(event.source.system, "sg");
assert.equal(event.source.transport, "internal");
assert.equal(event.source.module, "repo-commit-watcher");
assert.equal(event.actor.role, "system");
assert.equal(event.direction, "internal");
assert.equal(event.policy.sanitized, true);
assert.equal(event.policy.memory_candidate, false);
assert.equal(event.policy.retention, "latest_only");
assert.equal(event.payload.repo, "korzh260609-beep/garya-bot");
assert.equal(event.payload.branch, "dev/v2-start");
assert.equal(event.payload.has_new_commit, true);
assert.equal(event.payload.registry_updated, true);
assert.equal(event.payload.latest_commit.short_sha, "8d7bbafda63d");
assert.equal(event.payload.latest_commit.changed_files_count, 1);
assert.equal(event.payload.latest_commit.changed_files[0].filename, "runtime/render/latest/latest-render-env.json");
assert.equal(event.links.runtime_report_path, "runtime/repo/latest/latest-commit-state.json");
assert.equal(event.links.related_commit_sha, "8d7bbafda63d3157f1aca0b0f395cce2157cbaf8");
assert.equal(event.summary.includes("Repo commit observed"), true);

console.log("smokeRepoCommitObservationBridge: ok");
