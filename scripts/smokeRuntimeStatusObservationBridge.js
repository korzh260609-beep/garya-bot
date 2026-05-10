// scripts/smokeRuntimeStatusObservationBridge.js
// SG 2.0 smoke test for Runtime Status → Observation bridge.
// Purpose: prove public runtime status can be mapped into sanitized observation event input without writing runtime reports.

import assert from "node:assert/strict";

import {
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "../src/agents/observation/eventSchema.js";
import { buildRuntimeStatusObservationEventInput } from "../src/agents/observation/runtimeStatusObservationBridge.js";

const eventInput = buildRuntimeStatusObservationEventInput({
  nodeEnv: "test",
  telegramConfigured: true,
  monarchConfigured: true,
  aiConfigured: true,
  openaiModel: "gpt-test-model",
  baseUrlConfigured: true,
  secret_like_payload: "must_not_be_copied_to_observation_payload",
});

assert.equal(eventInput.event_type, OBSERVATION_EVENT_TYPES.RUNTIME_STATUS);
assert.equal(eventInput.source.system, "sg");
assert.equal(eventInput.source.transport, "internal");
assert.equal(eventInput.source.module, "runtimeStatusObservationBridge");
assert.equal(eventInput.actor.role, "system");
assert.equal(eventInput.actor.user_ref, "redacted");
assert.equal(eventInput.actor.chat_ref, "redacted");
assert.equal(eventInput.payload.runtime.nodeEnv, "test");
assert.equal(eventInput.payload.runtime.telegramConfigured, true);
assert.equal(eventInput.payload.runtime.monarchConfigured, true);
assert.equal(eventInput.payload.runtime.aiConfigured, true);
assert.equal(eventInput.payload.runtime.openaiModel, "gpt-test-model");
assert.equal(eventInput.payload.runtime.baseUrlConfigured, true);
assert.equal(Object.prototype.hasOwnProperty.call(eventInput.payload.runtime, "secret_like_payload"), false);
assert.equal(eventInput.policy.sensitivity, OBSERVATION_SENSITIVITY.INTERNAL);
assert.equal(eventInput.policy.retention, OBSERVATION_RETENTION.LATEST_ONLY);
assert.equal(eventInput.policy.sanitized, true);
assert.equal(eventInput.policy.memory_candidate, false);

const fallbackEventInput = buildRuntimeStatusObservationEventInput({
  nodeEnv: 123,
  telegramConfigured: 1,
  monarchConfigured: 0,
  aiConfigured: "yes",
  openaiModel: null,
  baseUrlConfigured: "",
});

assert.equal(fallbackEventInput.payload.runtime.nodeEnv, "unknown");
assert.equal(fallbackEventInput.payload.runtime.telegramConfigured, true);
assert.equal(fallbackEventInput.payload.runtime.monarchConfigured, false);
assert.equal(fallbackEventInput.payload.runtime.aiConfigured, true);
assert.equal(fallbackEventInput.payload.runtime.openaiModel, "unknown");
assert.equal(fallbackEventInput.payload.runtime.baseUrlConfigured, false);

console.log("OK: runtime status observation bridge builds sanitized observation event input");
