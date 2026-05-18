// scripts/smokeGithubActionsCommitRunsCheck.js
// SG 2.0 smoke test for GitHub Actions exact commit runs diagnostic check.
// Purpose: prove the check is read-only, requires exact commit SHA, can ignore the current observation run, can wait for active runs, and is registered in diagnostics.
// No GitHub writes, repo mutation, runtime writes, Telegram, AI, DB, raw logs, or secrets.

import assert from "node:assert/strict";

import {
  getGitHubActionsCommitRunsCheckBoundaries,
  runGitHubActionsCommitRunsCheck,
} from "../src/diagnostics/githubActionsCommitRunsCheck.js";
import { diagnosticsCheckRegistry } from "../src/agents/diagnostics-check-agent/diagnosticsCheckRegistry.js";

const boundaries = getGitHubActionsCommitRunsCheckBoundaries();
assert.equal(boundaries.readOnly, true);
assert.equal(boundaries.verifiesExactCommitSha, true);
assert.equal(boundaries.usesGitHubActionsRunsApi, true);
assert.equal(boundaries.canIgnoreCurrentObservationRun, true);
assert.equal(boundaries.canWaitForActiveRuns, true);
assert.equal(boundaries.writesGitHub, false);
assert.equal(boundaries.writesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.writesDatabase, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.emitsRawLogs, false);
assert.equal(boundaries.emitsSecrets, false);

const missingSha = await runGitHubActionsCommitRunsCheck({
  repo: "korzh260609-beep/garya-bot",
  branch: "dev/v2-start",
  commitSha: "",
  currentRunId: "26023985408",
  waitForCompletion: true,
  waitAttempts: 1,
  waitIntervalMs: 1000,
});

assert.equal(missingSha.ok, false);
assert.equal(missingSha.type, "github_actions_commit_runs_check");
assert.equal(missingSha.reason, "commit_sha_missing");
assert.equal(missingSha.readOnly, true);
assert.equal(missingSha.sanitized, true);
assert.equal(missingSha.boundaries.verifiesExactCommitSha, true);
assert.equal(missingSha.boundaries.canIgnoreCurrentObservationRun, true);
assert.equal(missingSha.boundaries.canWaitForActiveRuns, true);

const registered = diagnosticsCheckRegistry.find((item) => item?.name === "github_actions_commit_runs");
assert.equal(Boolean(registered), true);
assert.equal(typeof registered.run, "function");
assert.equal(typeof registered.summarize, "function");

console.log("smokeGithubActionsCommitRunsCheck: ok");
