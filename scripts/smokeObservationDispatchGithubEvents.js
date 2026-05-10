// scripts/smokeObservationDispatchGithubEvents.js
// SG 2.0 smoke test for GitHub event dispatch allowlist.

import assert from "node:assert/strict";

import {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  getObservationTriggerDispatchConfig,
  runObservationTriggerDispatchAgent,
} from "../src/agents/observation-trigger-dispatch-agent/index.js";

for (const eventType of [
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_PR_MERGED,
  OBSERVATION_DISPATCH_EVENT_TYPES.GITHUB_CI_FINISHED,
]) {
  const config = getObservationTriggerDispatchConfig(eventType);
  const result = await runObservationTriggerDispatchAgent({
    eventType,
    dryRun: true,
  });

  assert.equal(config.eventType, eventType);
  assert.equal(config.enabled, true);
  assert.equal(result.ok, true);
  assert.equal(result.type, "observation_trigger_dispatch_result");
  assert.equal(result.mode, "dry_run");
  assert.equal(result.eventType, eventType);
  assert.equal(result.triggerName, config.triggerName);
  assert.equal(result.wouldDispatch, true);
}

console.log("OK: GitHub events are allowlisted for observation dispatch");
