// AGENT NOTE:
// SG 2.0 Observation Trigger registry.
// Purpose: define the minimal allowlist of safe observation triggers.
// Do not add timers, Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, or autonomous actions here.

import { OBSERVATION_EVENT_TYPES } from "../eventSchema.js";

export const OBSERVATION_TRIGGER_NAMES = Object.freeze({
  DIAGNOSTICS_FINISHED: "diagnostics.finished",
  RUNTIME_STATUS_REQUESTED: "runtime.status_requested",
});

export const OBSERVATION_TRIGGER_REGISTRY = Object.freeze({
  [OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED]: Object.freeze({
    name: OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED,
    eventType: OBSERVATION_EVENT_TYPES.DIAGNOSTICS_RESULT,
    latestReportName: "diagnostics-latest",
    enabled: true,
  }),
  [OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED]: Object.freeze({
    name: OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED,
    eventType: OBSERVATION_EVENT_TYPES.RUNTIME_STATUS,
    latestReportName: "runtime-status-latest",
    enabled: true,
  }),
});

export function getObservationTriggerConfig(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  return OBSERVATION_TRIGGER_REGISTRY[name.trim()] || null;
}

export function isObservationTriggerAllowed(name) {
  const trigger = getObservationTriggerConfig(name);
  return Boolean(trigger?.enabled);
}

export default {
  OBSERVATION_TRIGGER_NAMES,
  OBSERVATION_TRIGGER_REGISTRY,
  getObservationTriggerConfig,
  isObservationTriggerAllowed,
};
