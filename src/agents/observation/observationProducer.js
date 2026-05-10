// AGENT NOTE:
// SG Observation Producer skeleton.
// Purpose: provide a narrow, safe entry point for producing sanitized observation events.
// Do not add Telegram integration, AI calls, memory writes, diagnostics orchestration, or autonomous behavior here.

import {
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
  createObservationEvent,
  validateObservationEvent,
} from "./eventSchema.js";
import { writeObservationLatestReport } from "./observationWriter.js";

function buildRejectedResult(reason, extra = {}) {
  return {
    ok: false,
    type: "observation_producer_result",
    reason,
    ...extra,
  };
}

function normalizeName(value, fallback = "latest") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function hasSecretPolicy(event = {}) {
  return event.policy?.sensitivity === OBSERVATION_SENSITIVITY.SECRET;
}

function hasUnsafeActorRefs(event = {}) {
  const userRef = typeof event.actor?.user_ref === "string" ? event.actor.user_ref : "";
  const chatRef = typeof event.actor?.chat_ref === "string" ? event.actor.chat_ref : "";

  return userRef !== "" && userRef !== "redacted" && !userRef.startsWith("usr_")
    || chatRef !== "" && chatRef !== "redacted" && !chatRef.startsWith("chat_");
}

export function buildObservationProducerEvent(input = {}) {
  const event = createObservationEvent({
    ...input,
    policy: {
      ...(input.policy || {}),
      sanitized: true,
      sensitivity: input.policy?.sensitivity || OBSERVATION_SENSITIVITY.INTERNAL,
      retention: input.policy?.retention || OBSERVATION_RETENTION.LATEST_ONLY,
    },
  });

  const validation = validateObservationEvent(event);

  if (!validation.ok) {
    return buildRejectedResult("invalid_observation_event", {
      validation,
      event,
    });
  }

  if (hasSecretPolicy(event)) {
    return buildRejectedResult("secret_observation_not_allowed", { event });
  }

  if (hasUnsafeActorRefs(event)) {
    return buildRejectedResult("unsafe_actor_ref_not_allowed", {
      event: {
        ...event,
        actor: {
          ...event.actor,
          user_ref: "redacted",
          chat_ref: "redacted",
        },
      },
    });
  }

  return {
    ok: true,
    type: "observation_producer_event",
    event,
    policy: {
      sanitized: true,
      noSecret: true,
      noRawProviderId: true,
      noMemoryWrite: true,
    },
  };
}

export async function produceObservationLatest({ name = "latest", eventInput = {}, summary = "" } = {}) {
  const built = buildObservationProducerEvent(eventInput);

  if (!built.ok) {
    return built;
  }

  const result = await writeObservationLatestReport({
    name: normalizeName(name),
    events: [built.event],
    summary,
  });

  if (!result.ok) {
    return buildRejectedResult(result.reason || "observation_write_failed", {
      writer: result,
    });
  }

  return {
    ok: true,
    type: "observation_producer_result",
    produced: true,
    path: result.path,
    eventType: built.event.event_type,
    eventsCount: result.report?.events_count || 1,
    policy: {
      sanitized: true,
      noSecret: true,
      noRawProviderId: true,
      noMemoryWrite: true,
    },
  };
}

export default {
  buildObservationProducerEvent,
  produceObservationLatest,
};
