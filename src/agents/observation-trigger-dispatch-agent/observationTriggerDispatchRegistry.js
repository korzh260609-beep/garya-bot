// AGENT NOTE:
// SG 2.0 Observation Trigger Dispatch Agent registry.
// Purpose: map bounded internal events to already allowlisted observation triggers.
// Do not add timers, Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

import { OBSERVATION_TRIGGER_NAMES } from "../observation/triggers/index.js";

export const OBSERVATION_DISPATCH_EVENT_TYPES = Object.freeze({
  DIAGNOSTICS_REQUESTED: "diagnostics.requested",
  RUNTIME_STATUS_REQUESTED: "runtime.status_requested",
  OBSERVATION_JOURNAL_HEALTH_REQUESTED: "observation.journal_health_requested",
});

export const OBSERVATION_TRIGGER_DISPATCH_REGISTRY = Object.freeze({
  [OBSERVATION_DISPATCH_EVENT_TYPES.DIAGNOSTICS_REQUESTED]: Object.freeze({
    eventType: OBSERVATION_DISPATCH_EVENT_TYPES.DIAGNOSTICS_REQUESTED,
    triggerName: OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED,
    enabled: true,
  }),
  [OBSERVATION_DISPATCH_EVENT_TYPES.RUNTIME_STATUS_REQUESTED]: Object.freeze({
    eventType: OBSERVATION_DISPATCH_EVENT_TYPES.RUNTIME_STATUS_REQUESTED,
    triggerName: OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED,
    enabled: true,
  }),
  [OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED]: Object.freeze({
    eventType: OBSERVATION_DISPATCH_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH_REQUESTED,
    triggerName: OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED,
    enabled: true,
  }),
});

export function getObservationTriggerDispatchConfig(eventType) {
  if (typeof eventType !== "string" || !eventType.trim()) return null;
  return OBSERVATION_TRIGGER_DISPATCH_REGISTRY[eventType.trim()] || null;
}

export function isObservationTriggerDispatchAllowed(eventType) {
  const config = getObservationTriggerDispatchConfig(eventType);
  return Boolean(config?.enabled);
}

export default {
  OBSERVATION_DISPATCH_EVENT_TYPES,
  OBSERVATION_TRIGGER_DISPATCH_REGISTRY,
  getObservationTriggerDispatchConfig,
  isObservationTriggerDispatchAllowed,
};
