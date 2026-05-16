// scripts/smokeObservationPrMergedDispatchWorkflow.js
// SG 2.0 — Observation PR merged dispatch workflow smoke.
// This smoke is deterministic and offline; it only validates workflow wiring text.

import assert from "node:assert/strict";
import fs from "node:fs";

import {
  getObservationTriggerDispatchConfig,
  isObservationTriggerDispatchAllowed,
} from "../src/agents/observation-trigger-dispatch-agent/observationTriggerDispatchRegistry.js";

const workflowPath = ".github/workflows/observation-pr-merged-dispatch.yml";
const workflow = fs.readFileSync(workflowPath, "utf8");

assert.equal(workflow.includes("name: Observation PR Merged Dispatch"), true);
assert.equal(workflow.includes("pull_request:"), true);
assert.equal(workflow.includes("- closed"), true);
assert.equal(workflow.includes("- dev/v2-start"), true);
assert.equal(workflow.includes("github.event.pull_request.merged == true"), true);
assert.equal(workflow.includes("actions/checkout@v4"), true);
assert.equal(workflow.includes("ref: dev/v2-start"), true);
assert.equal(workflow.includes("runRepoCommitWatcherAgent.js"), true);
assert.equal(workflow.includes("runObservationTriggerDispatchAgent.js"), true);
assert.equal(workflow.includes("OBSERVATION_DISPATCH_EVENT_TYPE: github.pr_merged"), true);
assert.equal(workflow.includes("contents: write"), true);
assert.equal(workflow.includes("actions: read"), true);

const config = getObservationTriggerDispatchConfig("github.pr_merged");
assert.equal(Boolean(config), true);
assert.equal(config.eventType, "github.pr_merged");
assert.equal(config.triggerName, "observation.journal_health_requested");
assert.equal(config.enabled, true);
assert.equal(isObservationTriggerDispatchAllowed("github.pr_merged"), true);

console.log("smokeObservationPrMergedDispatchWorkflow: ok");
