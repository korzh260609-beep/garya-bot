// AGENT NOTE:
// SG Observation Agents event schema contract.
// Purpose: define a minimal sanitized observation event shape for future observer agents.
// This file must stay deterministic and dependency-free.
// Do not add Telegram logic, AI calls, GitHub writes, Render calls, or memory writes here.

export const OBSERVATION_SCHEMA_VERSION = 1;

export const OBSERVATION_EVENT_TYPES = Object.freeze({
  TRANSPORT_MESSAGE: "transport.message",
  TRANSPORT_DELIVERY: "transport.delivery",
  TOOL_CALL: "tool.call",
  TOOL_RESULT: "tool.result",
  RUNTIME_STATUS: "runtime.status",
  DIAGNOSTICS_RESULT: "diagnostics.result",
  CONVERSATION_AUDIT: "conversation.audit",
  SUPERVISOR_NOTE: "supervisor.note",
});

export const OBSERVATION_DIRECTIONS = Object.freeze({
  INBOUND: "inbound",
  OUTBOUND: "outbound",
  INTERNAL: "internal",
});

export const OBSERVATION_ACTOR_ROLES = Object.freeze({
  MONARCH: "monarch",
  CITIZEN: "citizen",
  GUEST: "guest",
  SYSTEM: "system",
  UNKNOWN: "unknown",
});

export const OBSERVATION_SENSITIVITY = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  PRIVATE: "private",
  SECRET: "secret",
});

export const OBSERVATION_RETENTION = Object.freeze({
  LATEST_ONLY: "latest_only",
  SHORT_TERM: "short_term",
  MEMORY_CANDIDATE: "memory_candidate",
  DO_NOT_STORE: "do_not_store",
});

export function createObservationEvent(input = {}) {
  const now = new Date().toISOString();

  return {
    schema_version: OBSERVATION_SCHEMA_VERSION,
    event_id: typeof input.event_id === "string" ? input.event_id : "",
    event_type: typeof input.event_type === "string" ? input.event_type : "",
    created_at: typeof input.created_at === "string" ? input.created_at : now,
    source: {
      system: typeof input.source?.system === "string" ? input.source.system : "sg",
      transport: typeof input.source?.transport === "string" ? input.source.transport : "unknown",
      module: typeof input.source?.module === "string" ? input.source.module : "unknown",
    },
    actor: {
      role: typeof input.actor?.role === "string" ? input.actor.role : OBSERVATION_ACTOR_ROLES.UNKNOWN,
      user_ref: typeof input.actor?.user_ref === "string" ? input.actor.user_ref : "redacted",
      chat_ref: typeof input.actor?.chat_ref === "string" ? input.actor.chat_ref : "redacted",
    },
    direction: typeof input.direction === "string" ? input.direction : OBSERVATION_DIRECTIONS.INTERNAL,
    summary: typeof input.summary === "string" ? input.summary : "",
    payload: input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {},
    tool: input.tool && typeof input.tool === "object" && !Array.isArray(input.tool)
      ? {
          name: typeof input.tool.name === "string" ? input.tool.name : "",
          ok: typeof input.tool.ok === "boolean" ? input.tool.ok : null,
          error: typeof input.tool.error === "string" ? input.tool.error : null,
        }
      : null,
    policy: {
      sensitivity: typeof input.policy?.sensitivity === "string" ? input.policy.sensitivity : OBSERVATION_SENSITIVITY.INTERNAL,
      retention: typeof input.policy?.retention === "string" ? input.policy.retention : OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: input.policy?.sanitized !== false,
      memory_candidate: Boolean(input.policy?.memory_candidate),
    },
    links: {
      runtime_report_path: typeof input.links?.runtime_report_path === "string" ? input.links.runtime_report_path : "",
      related_commit_sha: typeof input.links?.related_commit_sha === "string" ? input.links.related_commit_sha : "",
      related_run_id: typeof input.links?.related_run_id === "string" ? input.links.related_run_id : "",
    },
  };
}

export function validateObservationEvent(event = {}) {
  const errors = [];

  if (event.schema_version !== OBSERVATION_SCHEMA_VERSION) errors.push("invalid_schema_version");
  if (!event.event_type) errors.push("event_type_missing");
  if (!event.created_at) errors.push("created_at_missing");
  if (!event.source?.system) errors.push("source_system_missing");
  if (!event.source?.module) errors.push("source_module_missing");
  if (!event.actor?.role) errors.push("actor_role_missing");
  if (!event.direction) errors.push("direction_missing");
  if (event.policy?.sensitivity === OBSERVATION_SENSITIVITY.SECRET) errors.push("secret_observation_not_allowed");
  if (event.policy?.sanitized !== true) errors.push("event_not_sanitized");

  return {
    ok: errors.length === 0,
    errors,
  };
}
