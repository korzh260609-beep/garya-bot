// scripts/smokeObservationJournalHealthTrigger.js
// SG 2.0 smoke test for Observation Journal Health trigger.
// Purpose: prove the trigger is allowlisted and can produce a sanitized latest-only journal health report.

import assert from "node:assert/strict";

import {
  getObservationTriggerConfig,
  isObservationTriggerAllowed,
  OBSERVATION_TRIGGER_NAMES,
  runObservationTrigger,
} from "../src/agents/observation/triggers/index.js";

const trigger = getObservationTriggerConfig(OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);

assert.equal(trigger.name, OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);
assert.equal(trigger.enabled, true);
assert.equal(trigger.latestReportName, "observation-journal-health-latest");
assert.equal(isObservationTriggerAllowed(OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED), true);

const result = await runObservationTrigger({
  name: OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED,
  payload: {
    reportNames: [
      "diagnostics-latest",
      "runtime-status-latest",
    ],
  },
});

assert.equal(result.ok, true);
assert.equal(result.type, "observation_trigger_result");
assert.equal(result.trigger, OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);
assert.equal(result.latestReportName, "observation-journal-health-latest");
assert.equal(result.observation.ok, true);
assert.equal(result.observation.report.name, "observation-journal-health-latest");
assert.equal(result.observation.report.policy.sanitized, true);
assert.equal(result.observation.report.policy.no_memory_write, true);
assert.equal(result.observation.report.events_count, 1);

const event = result.observation.report.events[0];

assert.equal(event.event_type, "observation.journal_health");
assert.equal(event.source.transport, "internal");
assert.equal(event.source.module, "observation-journal-health");
assert.equal(event.actor.user_ref, "redacted");
assert.equal(event.actor.chat_ref, "redacted");
assert.equal(event.policy.sanitized, true);
assert.equal(event.policy.retention, "latest_only");
assert.equal(event.policy.memory_candidate, false);
assert.equal(Object.prototype.hasOwnProperty.call(event.payload, "raw_logs"), false);
assert.equal(Object.prototype.hasOwnProperty.call(event.payload, "raw_provider_id"), false);

console.log("OK: observation journal health trigger produces sanitized latest-only report");
