// scripts/smokeObservationTriggerLayer.js
// SG 2.0 smoke test for Observation Trigger Layer skeleton.
// Purpose: prove trigger registry uses an allowlist, rejects unknown triggers, and refreshes journal health after runtime status.
// This smoke is read-only: producer calls are injected to avoid runtime workspace writes in CI.

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
    ignored_value: "must_not_be_used",
  },
});

assert.equal(rejected.ok, false);
assert.equal(rejected.type, "observation_trigger_result");
assert.equal(rejected.reason, "observation_trigger_not_allowed");
assert.equal(Object.prototype.hasOwnProperty.call(rejected, "observation"), false);

const runtimeProducerCalls = [];
const runtimeResult = await runObservationTrigger({
  name: OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED,
  payload: {
    runtimeStatus: {
      nodeEnv: "test",
      telegramConfigured: true,
      monarchConfigured: true,
      aiConfigured: true,
      openaiModel: "test-model",
      baseUrlConfigured: true,
    },
  },
  context: {
    testProducers: {
      produceRuntimeStatusObservationLatest(runtimeStatus) {
        runtimeProducerCalls.push({ producer: "runtime", runtimeStatus });
        return {
          ok: true,
          type: "observation_producer_result",
          produced: true,
          path: "runtime/observation/latest/runtime-status-latest.json",
        };
      },
      produceObservationJournalHealthLatest() {
        runtimeProducerCalls.push({ producer: "journalHealth" });
        return {
          ok: true,
          type: "observation_write_result",
          produced: true,
          path: "runtime/observation/latest/observation-journal-health-latest.json",
        };
      },
    },
  },
});

assert.equal(runtimeResult.ok, true);
assert.equal(runtimeResult.type, "observation_trigger_result");
assert.equal(runtimeResult.trigger, OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED);
assert.equal(runtimeResult.latestReportName, "runtime-status-latest");
assert.equal(runtimeResult.observation.ok, true);
assert.equal(runtimeResult.observation.produced, true);
assert.equal(runtimeResult.journalHealthObservation.ok, true);
assert.equal(runtimeResult.journalHealthObservation.produced, true);
assert.deepEqual(runtimeProducerCalls.map((call) => call.producer), ["runtime", "journalHealth"]);

console.log("OK: observation trigger layer uses allowlist and refreshes journal health after runtime status");
