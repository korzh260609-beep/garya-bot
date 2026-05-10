// scripts/smokeObservationTriggerDispatchAgent.js
// SG 2.0 smoke test for Observation Trigger Dispatch Agent.
// Purpose: prove allowed events route to existing observation triggers and unknown events are rejected without writing latest reports in CI.

import assert from "node:assert/strict";

import {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  getObservationTriggerDispatchConfig,
  isObservationTriggerDispatchAllowed,
  runObservationTriggerDispatchAgent,
} from "../src/agents/observation-trigger-dispatch-agent/index.js";

const config = getObservationTriggerDispatchConfig(
  OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED
);

assert.equal(config.eventType, OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);
assert.equal(config.enabled, true);
assert.equal(isObservationTriggerDispatchAllowed(config.eventType), true);
assert.equal(getObservationTriggerDispatchConfig("observation.unknown"), null);
assert.equal(isObservationTriggerDispatchAllowed("observation.unknown"), false);

const rejected = await runObservationTriggerDispatchAgent({
  eventType: "observation.unknown",
});

assert.equal(rejected.ok, false);
assert.equal(rejected.type, "observation_trigger_dispatch_result");
assert.equal(rejected.reason, "observation_dispatch_event_not_allowed");

const result = await runObservationTriggerDispatchAgent({
  eventType: OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED,
  dryRun: true,
  payload: {
    reportNames: ["diagnostics-latest", "runtime-status-latest"],
  },
});

assert.equal(result.ok, true);
assert.equal(result.type, "observation_trigger_dispatch_result");
assert.equal(result.mode, "dry_run");
assert.equal(result.eventType, OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);
assert.equal(result.triggerName, config.triggerName);
assert.equal(result.wouldDispatch, true);
assert.equal(Object.prototype.hasOwnProperty.call(result, "triggerResult"), false);

console.log("OK: observation trigger dispatch agent routes allowed events safely");
