// AGENT NOTE:
// SG 2.0 Observation Trigger runner.
// Purpose: execute allowed observation trigger producers through a tiny deterministic router.
// Do not add timers, Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, or autonomous actions here.

import { produceDiagnosticsObservationLatest } from "../../../diagnostics/diagnosticsObservationBridge.js";
import { produceObservationJournalHealthLatest } from "../journalHealthObservationBridge.js";
import { produceRuntimeStatusObservationLatest } from "../runtimeStatusObservationBridge.js";
import {
  getObservationTriggerConfig,
  OBSERVATION_TRIGGER_NAMES,
} from "./observationTriggerRegistry.js";

function rejected(reason, extra = {}) {
  return {
    ok: false,
    type: "observation_trigger_result",
    reason,
    ...extra,
  };
}

function formatTriggerResult({ trigger, observation, journalHealthObservation = null }) {
  return {
    ok: Boolean(observation?.ok) && (!journalHealthObservation || Boolean(journalHealthObservation.ok)),
    type: "observation_trigger_result",
    trigger: trigger.name,
    eventType: trigger.eventType,
    latestReportName: trigger.latestReportName,
    observation,
    journalHealthObservation,
  };
}

function getTriggerProducers(context = {}) {
  const overrides = context.testProducers || {};

  return {
    produceDiagnosticsObservationLatest:
      overrides.produceDiagnosticsObservationLatest || produceDiagnosticsObservationLatest,
    produceRuntimeStatusObservationLatest:
      overrides.produceRuntimeStatusObservationLatest || produceRuntimeStatusObservationLatest,
    produceObservationJournalHealthLatest:
      overrides.produceObservationJournalHealthLatest || produceObservationJournalHealthLatest,
  };
}

export async function runObservationTrigger({ name, payload = {}, context = {} } = {}) {
  const trigger = getObservationTriggerConfig(name);

  if (!trigger?.enabled) {
    return rejected("observation_trigger_not_allowed", { name: typeof name === "string" ? name : "" });
  }

  const producers = getTriggerProducers(context);

  if (trigger.name === OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED) {
    const observation = await producers.produceDiagnosticsObservationLatest(
      payload.diagnosticsResult || {},
      context,
    );

    return formatTriggerResult({ trigger, observation });
  }

  if (trigger.name === OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED) {
    const observation = await producers.produceRuntimeStatusObservationLatest(payload.runtimeStatus);
    const journalHealthObservation = await producers.produceObservationJournalHealthLatest();

    return formatTriggerResult({ trigger, observation, journalHealthObservation });
  }

  if (trigger.name === OBSERVATION_TRIGGER_NAMES.OBSERVATION_JOURNAL_HEALTH_REQUESTED) {
    const observation = await producers.produceObservationJournalHealthLatest(payload);

    return formatTriggerResult({ trigger, observation });
  }

  return rejected("observation_trigger_handler_missing", { name: trigger.name });
}

export default {
  runObservationTrigger,
};
