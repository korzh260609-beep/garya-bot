// scripts/smokeObservationJournalHealthTrigger.js
// SG 2.0 smoke test for Observation Journal Health trigger.
// Purpose: prove the trigger is allowlisted and mapped to the sanitized latest-only journal health report.
// This smoke is read-only: it must not write runtime reports in CI.

import assert from "node:assert/strict";

import { OBSERVATION_EVENT_TYPES } from "../src/agents/observation/eventSchema.js";
import {
  getObservationTriggerConfig,
  isObservationTriggerAllowed,
  OBSERVATION_TRIGGER_NAMES,
} from "../src/agents/observation/triggers/index.js";

const trigger = getObservationTriggerConfig(OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);

assert.equal(trigger.name, OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED);
assert.equal(trigger.enabled, true);
assert.equal(trigger.eventType, OBSERVATION_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH);
assert.equal(trigger.latestReportName, "observation-journal-health-latest");
assert.equal(isObservationTriggerAllowed(OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED), true);

assert.equal(getObservationTriggerConfig("observation.journal_health_unknown"), null);
assert.equal(isObservationTriggerAllowed("observation.journal_health_unknown"), false);

console.log("OK: observation journal health trigger is allowlisted and mapped to latest-only report");
