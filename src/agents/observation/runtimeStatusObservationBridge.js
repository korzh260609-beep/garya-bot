// AGENT NOTE:
// SG 2.0 Runtime Status → Observation bridge.
// Purpose: convert safe public runtime status into a sanitized observation event.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, diagnostics orchestration, or autonomous behavior here.

import { getPublicRuntimeStatus } from "../../config/env.js";
import {
  OBSERVATION_ACTOR_ROLES,
  OBSERVATION_DIRECTIONS,
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "./eventSchema.js";
import { produceObservationLatest } from "./observationProducer.js";

function normalizeRuntimeStatus(runtimeStatus = {}) {
  return {
    nodeEnv: typeof runtimeStatus.nodeEnv === "string" ? runtimeStatus.nodeEnv : "unknown",
    telegramConfigured: Boolean(runtimeStatus.telegramConfigured),
    monarchConfigured: Boolean(runtimeStatus.monarchConfigured),
    aiConfigured: Boolean(runtimeStatus.aiConfigured),
    openaiModel: typeof runtimeStatus.openaiModel === "string" ? runtimeStatus.openaiModel : "unknown",
    baseUrlConfigured: Boolean(runtimeStatus.baseUrlConfigured),
  };
}

export function buildRuntimeStatusObservationEventInput(runtimeStatus = getPublicRuntimeStatus()) {
  const safeRuntimeStatus = normalizeRuntimeStatus(runtimeStatus);

  return {
    event_id: `runtime_status_${Date.now()}`,
    event_type: OBSERVATION_EVENT_TYPES.RUNTIME_STATUS,
    source: {
      system: "sg",
      transport: "internal",
      module: "runtimeStatusObservationBridge",
    },
    actor: {
      role: OBSERVATION_ACTOR_ROLES.SYSTEM,
      user_ref: "redacted",
      chat_ref: "redacted",
    },
    direction: OBSERVATION_DIRECTIONS.INTERNAL,
    summary: safeRuntimeStatus.aiConfigured
      ? "Runtime status observed: AI configured."
      : "Runtime status observed: AI not configured.",
    payload: {
      runtime: safeRuntimeStatus,
    },
    policy: {
      sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
      retention: OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: true,
      memory_candidate: false,
    },
    links: {
      runtime_report_path: "",
      related_commit_sha: "",
      related_run_id: "",
    },
  };
}

export async function produceRuntimeStatusObservationLatest(runtimeStatus = getPublicRuntimeStatus()) {
  const eventInput = buildRuntimeStatusObservationEventInput(runtimeStatus);

  return produceObservationLatest({
    name: "runtime-status-latest",
    eventInput,
    summary: eventInput.summary,
  });
}

export default {
  buildRuntimeStatusObservationEventInput,
  produceRuntimeStatusObservationLatest,
};
