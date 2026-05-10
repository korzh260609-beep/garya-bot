// scripts/smokeDiagnosticsObservationBridge.js
// SG 2.0 smoke test for Diagnostics → Observation bridge.
// Purpose: prove diagnostics results can be mapped into sanitized observation event input without writing runtime reports.

import assert from "node:assert/strict";

import {
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "../src/agents/observation/eventSchema.js";
import { buildDiagnosticsObservationEventInput } from "../src/diagnostics/diagnosticsObservationBridge.js";

const eventInput = buildDiagnosticsObservationEventInput({
  ok: true,
  type: "sg_diagnostics_check",
  mode: "runtime_orchestration",
  plan: {
    mode: "read_only",
  },
  report: {
    type: "sg_diagnostics_report",
    results: [
      {
        ok: true,
        type: "users_identity_registry",
        summary: "Users identity registry check passed.",
        data: {
          secret_like_payload: "must_not_be_copied_to_observation_payload",
        },
      },
      {
        ok: true,
        type: "users_identity_link_requests",
        summary: "Users identity link requests check passed.",
      },
    ],
  },
}, {
  isMonarch: true,
  globalUserId: "usr_48cc07c069030fb3",
});

assert.equal(eventInput.event_type, OBSERVATION_EVENT_TYPES.DIAGNOSTICS_RESULT);
assert.equal(eventInput.source.module, "diagnosticsObservationBridge");
assert.equal(eventInput.actor.role, "monarch");
assert.equal(eventInput.actor.user_ref, "usr_48cc07c069030fb3");
assert.equal(eventInput.actor.chat_ref, "redacted");
assert.equal(eventInput.payload.diagnostics_ok, true);
assert.equal(eventInput.payload.checks_count, 2);
assert.equal(eventInput.payload.failed_count, 0);
assert.deepEqual(eventInput.payload.check_types, [
  "users_identity_registry",
  "users_identity_link_requests",
]);
assert.equal(eventInput.payload.results.length, 2);
assert.equal(Object.prototype.hasOwnProperty.call(eventInput.payload.results[0], "data"), false);
assert.equal(eventInput.policy.sensitivity, OBSERVATION_SENSITIVITY.INTERNAL);
assert.equal(eventInput.policy.retention, OBSERVATION_RETENTION.LATEST_ONLY);
assert.equal(eventInput.policy.sanitized, true);
assert.equal(eventInput.policy.memory_candidate, false);

const redactedEventInput = buildDiagnosticsObservationEventInput({
  ok: false,
  report: {
    results: [],
  },
}, {
  isMonarch: false,
  globalUserId: "telegram:123456789",
});

assert.equal(redactedEventInput.actor.role, "system");
assert.equal(redactedEventInput.actor.user_ref, "redacted");
assert.equal(redactedEventInput.payload.diagnostics_ok, false);

console.log("OK: diagnostics observation bridge builds sanitized observation event input");
