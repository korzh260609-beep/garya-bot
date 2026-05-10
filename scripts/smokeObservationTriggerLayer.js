// scripts/smokeObservationTriggerLayer.js
// SG 2.0 smoke test for Observation Trigger Layer skeleton.
// Purpose: prove trigger registry uses an allowlist and does not execute unknown triggers.

import assert from "node:assert/strict";

import {
  getObservationTriggerConfig,
  isObservationTriggerAllowed,
  OBSERVATION_TRIGGER_NAMES,
  runObservationTrigger,
} from "../src/agents/observation/triggers/index.js";

const diagnosticsTrigger = getObservationTriggerConfig(OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED);
assert.equal(diagnosticsTrigger.name, OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED);
assert.equal(diagnosticsTrigger.enabled, true);
assert.equal(diagnosticsTrigger.latestReportName, "diagnostics-latest");
assert.equal(isObservationTriggerAllowed(OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED), true);

const runtimeTrigger = getObservationTriggerConfig(OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED);
assert.equal(runtimeTrigger.name, OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED);
assert.equal(runtimeTrigger.enabled, true);
assert.equal(runtimeTrigger.latestReportName, "runtime-status-latest");
assert.equal(isObservationTriggerAllowed(OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED), true);

assert.equal(getObservationTriggerConfig("unknown.trigger"), null);
assert.equal(isObservationTriggerAllowed("unknown.trigger"), false);

const rejected = await runObservationTrigger({
  name: "unknown.trigger",
  payload: {
    raw_secret_like_value: "must_not_be_used",
  },
});

assert.equal(rejected.ok, false);
assert.equal(rejected.type, "observation_trigger_result");
assert.equal(rejected.reason, "observation_trigger_not_allowed");
assert.equal(Object.prototype.hasOwnProperty.call(rejected, "observation"), false);

console.log("OK: observation trigger layer uses allowlist and rejects unknown triggers");
