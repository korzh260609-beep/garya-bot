// AGENT NOTE:
// SG Observation report reader boundary.
// Purpose: read sanitized observation reports through the shared workspace channel.
// This is a narrow IO boundary only.
// Do not add Telegram logic, AI calls, diagnostics orchestration, memory reads/writes, or autonomous behavior here.

import workspaceChannel from "../../runtime/workspace/workspaceChannel.js";
import { buildObservationLatestPath, isObservationRuntimePath } from "./observationPaths.js";

function safeParseJson(text) {
  try {
    return {
      ok: true,
      data: JSON.parse(text),
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "json_parse_failed",
    };
  }
}

export async function readObservationLatestReport({ name = "latest" } = {}) {
  const path = buildObservationLatestPath(name);

  if (!isObservationRuntimePath(path)) {
    return {
      ok: false,
      type: "observation_read_rejected",
      reason: "path_outside_observation_runtime",
      path,
    };
  }

  try {
    const result = await workspaceChannel.readText(path);
    const parsed = safeParseJson(result.text);

    if (!parsed.ok) {
      return {
        ok: false,
        type: "observation_read_failed",
        reason: "invalid_json_report",
        path,
        error: parsed.error,
      };
    }

    return {
      ok: true,
      type: "observation_read_result",
      path,
      sha: result.sha,
      report: parsed.data,
    };
  } catch (error) {
    return {
      ok: false,
      type: "observation_read_failed",
      reason: "workspace_read_failed",
      path,
      error: error?.message || "workspace_read_failed",
    };
  }
}
