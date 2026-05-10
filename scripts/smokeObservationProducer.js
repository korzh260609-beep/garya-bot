// scripts/smokeObservationProducer.js
// SG 2.0 smoke test for Observation Producer skeleton.
// Purpose: prove producer builds safe sanitized observation events without writing runtime reports.

import assert from "node:assert/strict";

import {
  OBSERVATION_DIRECTIONS,
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "../src/agents/observation/eventSchema.js";
import { buildObservationProducerEvent } from "../src/agents/observation/observationProducer.js";

const safe = buildObservationProducerEvent({
  event_id: "obs_smoke_producer_safe",
  event_type: OBSERVATION_EVENT_TYPES.RUNTIME_STATUS,
  source: {
    system: "sg",
    transport: "system",
    module: "smokeObservationProducer",
  },
  actor: {
    role: "system",
    user_ref: "redacted",
    chat_ref: "redacted",
  },
  direction: OBSERVATION_DIRECTIONS.INTERNAL,
  summary: "Observation producer smoke event.",
  payload: {
    check: "observation_producer",
  },
  policy: {
    sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
    retention: OBSERVATION_RETENTION.LATEST_ONLY,
  },
});

assert.equal(safe.ok, true);
assert.equal(safe.type, "observation_producer_event");
assert.equal(safe.event.event_type, OBSERVATION_EVENT_TYPES.RUNTIME_STATUS);
assert.equal(safe.event.policy.sanitized, true);
assert.equal(safe.policy.noSecret, true);
assert.equal(safe.policy.noRawProviderId, true);
assert.equal(safe.policy.noMemoryWrite, true);

const rejectedSecret = buildObservationProducerEvent({
  event_id: "obs_smoke_producer_secret",
  event_type: OBSERVATION_EVENT_TYPES.RUNTIME_STATUS,
  source: {
    system: "sg",
    transport: "system",
    module: "smokeObservationProducer",
  },
  actor: {
    role: "system",
    user_ref: "redacted",
    chat_ref: "redacted",
  },
  direction: OBSERVATION_DIRECTIONS.INTERNAL,
  summary: "Secret event must be rejected.",
  policy: {
    sensitivity: OBSERVATION_SENSITIVITY.SECRET,
    retention: OBSERVATION_RETENTION.DO_NOT_STORE,
  },
});

assert.equal(rejectedSecret.ok, false);
assert.equal(rejectedSecret.reason, "invalid_observation_event");

const rejectedRawRef = buildObservationProducerEvent({
  event_id: "obs_smoke_producer_raw_ref",
  event_type: OBSERVATION_EVENT_TYPES.RUNTIME_STATUS,
  source: {
    system: "sg",
    transport: "telegram",
    module: "smokeObservationProducer",
  },
  actor: {
    role: "guest",
    user_ref: "123456789",
    chat_ref: "987654321",
  },
  direction: OBSERVATION_DIRECTIONS.INBOUND,
  summary: "Raw provider refs must be rejected.",
});

assert.equal(rejectedRawRef.ok, false);
assert.equal(rejectedRawRef.reason, "unsafe_actor_ref_not_allowed");
assert.equal(rejectedRawRef.event.actor.user_ref, "redacted");
assert.equal(rejectedRawRef.event.actor.chat_ref, "redacted");

console.log("OK: observation producer builds safe events and rejects unsafe input");
