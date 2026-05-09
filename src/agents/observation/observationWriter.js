// AGENT NOTE:
// SG Observation report writer boundary.
// Purpose: write sanitized observation reports through the shared workspace channel.
// This is a narrow IO boundary only.
// Do not add Telegram logic, AI calls, diagnostics orchestration, memory writes, or autonomous behavior here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { validateObservationEvent } from "./eventSchema.js";
import { buildObservationLatestPath, isObservationRuntimePath } from "./observationPaths.js";

function normalizeName(value, fallback = "latest") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeEvents(events) {
  if (Array.isArray(events)) return events;
  if (events && typeof events === "object") return [events];
  return [];
}

export function buildObservationReport({ name, events, summary } = {}) {
  const normalizedEvents = normalizeEvents(events);
  const validations = normalizedEvents.map(validateObservationEvent);
  const invalid = validations
    .map((validation, index) => ({ index, ...validation }))
    .filter((validation) => !validation.ok);

  return {
    ok: invalid.length === 0,
    type: "observation_report",
    generated_at: new Date().toISOString(),
    name: normalizeName(name),
    summary: typeof summary === "string" ? summary : "",
    events_count: normalizedEvents.length,
    invalid_events_count: invalid.length,
    invalid_events: invalid,
    events: normalizedEvents,
    policy: {
      sanitized: true,
      runtime_path_only: true,
      no_memory_write: true,
    },
  };
}

export async function writeObservationLatestReport({ name = "latest", events = [], summary = "" } = {}) {
  const report = buildObservationReport({ name, events, summary });

  if (!report.ok) {
    return {
      ok: false,
      type: "observation_write_rejected",
      reason: "invalid_observation_events",
      report,
    };
  }

  const path = buildObservationLatestPath(name);

  if (!isObservationRuntimePath(path)) {
    return {
      ok: false,
      type: "observation_write_rejected",
      reason: "path_outside_observation_runtime",
      path,
    };
  }

  const result = await workspaceChannel.writeJson(path, report, {
    message: `observation: update ${path}`,
  });

  return {
    ok: true,
    type: "observation_write_result",
    path,
    report,
    workspace: result,
  };
}
