// scripts/smokeObservationAutoDispatchProbe.js
// SG 2.0 — Observation auto-dispatch probe.
// Purpose: create a tiny safe PR to verify that merged PR events trigger the Observation nervous system.
// This smoke is deterministic and offline; it does not touch GitHub/network/DB/AI/transport/runtime.

import assert from "node:assert/strict";

import {
  getObservationTriggerDispatchConfig,
  isObservationTriggerDispatchAllowed,
} from "../src/agents/observation-trigger-dispatch-agent/observationTriggerDispatchRegistry.js";

const config = getObservationTriggerDispatchConfig("github.pr_merged");

assert.equal(Boolean(config), true);
assert.equal(config.eventType, "github.pr_merged");
assert.equal(config.triggerName, "observation.journal_health_requested");
assert.equal(config.enabled, true);
assert.equal(isObservationTriggerDispatchAllowed("github.pr_merged"), true);

console.log("smokeObservationAutoDispatchProbe: ok");
