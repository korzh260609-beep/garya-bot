// scripts/smokeRepoCommitWatcherObservationDispatchPolicy.js
// SG 2.0 — Repo Commit Watcher Observation dispatch policy smoke.
// This smoke must stay deterministic, offline, and must not touch GitHub/network.
//
// Purpose:
// - Ensure Observation dispatch is not coupled to merge commit message text.
// - Ensure Observation runtime files do not retrigger the watcher loop.
// - Ensure the new repository update dispatch event is allowlisted.

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getObservationTriggerDispatchConfig,
  isObservationTriggerDispatchAllowed,
} from "../src/agents/observation-trigger-dispatch-agent/observationTriggerDispatchRegistry.js";

const workflowPath = ".github/workflows/repo-commit-watcher.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");

assert.equal(workflow.includes("runtime/observation/**"), true);
assert.equal(workflow.includes("github.repository_updated"), true);
assert.equal(workflow.includes("github.event_name == 'push' || github.event_name == 'workflow_dispatch'"), true);
assert.equal(workflow.includes("contains(github.event.head_commit.message"), false);
assert.equal(workflow.includes("Merge PR"), false);
assert.equal(workflow.includes("Merge pull request"), false);
assert.equal(workflow.includes("runObservationTriggerDispatchAgent.js"), true);

const config = getObservationTriggerDispatchConfig("github.repository_updated");
assert.equal(Boolean(config), true);
assert.equal(config.eventType, "github.repository_updated");
assert.equal(config.triggerName, "observation.journal_health_requested");
assert.equal(config.enabled, true);
assert.equal(isObservationTriggerDispatchAllowed("github.repository_updated"), true);

console.log("smokeRepoCommitWatcherObservationDispatchPolicy: ok");
