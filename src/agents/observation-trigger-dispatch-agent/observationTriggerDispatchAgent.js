// AGENT NOTE:
// SG 2.0 Observation Trigger Dispatch Agent.
// Purpose: route bounded internal events to already allowlisted observation triggers.
// This agent does not observe by timer and does not act autonomously; it only reacts to explicit input events.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

import { runObservationTrigger } from "../observation/triggers/index.js";
import { getObservationTriggerDispatchConfig } from "./observationTriggerDispatchRegistry.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function rejected(reason, extra = {}) {
  return {
    ok: false,
    type: "observation_trigger_dispatch_result",
    reason,
    ...extra,
  };
}

export async function runObservationTriggerDispatchAgent(input = {}) {
  const eventType = normalizeText(input.eventType || input.type);
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const dryRun = input.dryRun === true;
  const dispatchConfig = getObservationTriggerDispatchConfig(eventType);

  if (!dispatchConfig?.enabled) {
    return rejected("observation_dispatch_event_not_allowed", { eventType });
  }

  if (dryRun) {
    return {
      ok: true,
      type: "observation_trigger_dispatch_result",
      mode: "dry_run",
      eventType,
      triggerName: dispatchConfig.triggerName,
      wouldDispatch: true,
    };
  }

  const triggerResult = await runObservationTrigger({
    name: dispatchConfig.triggerName,
    payload,
    context,
  });

  return {
    ok: Boolean(triggerResult?.ok),
    type: "observation_trigger_dispatch_result",
    mode: "dispatch",
    eventType,
    triggerName: dispatchConfig.triggerName,
    triggerResult,
  };
}

export default {
  runObservationTriggerDispatchAgent,
};
