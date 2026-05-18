// AGENT NOTE:
// SG 2.0 Diagnostics → Observation bridge.
// Purpose: convert sanitized diagnostics results into observation events for SG's journal/nervous-system layer.
// Do not add Telegram integration, AI calls, memory writes, raw log storage, raw provider IDs, or autonomous behavior here.

import {
  OBSERVATION_ACTOR_ROLES,
  OBSERVATION_DIRECTIONS,
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "../agents/observation/eventSchema.js";
import { produceObservationLatest } from "../agents/observation/observationProducer.js";

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text || fallback;
}

function safeActorRole(context = {}) {
  if (context.isMonarch) return OBSERVATION_ACTOR_ROLES.MONARCH;
  return OBSERVATION_ACTOR_ROLES.SYSTEM;
}

function safeActorUserRef(context = {}) {
  const globalUserId = normalizeText(context.globalUserId || context.identity?.globalUserId);
  return globalUserId.startsWith("usr_") ? globalUserId : "redacted";
}

function summarizeResults(results = []) {
  const safeResults = Array.isArray(results) ? results : [];

  return safeResults.map((item) => ({
    type: normalizeText(item?.type, "unknown"),
    ok: Boolean(item?.ok),
    summary: normalizeText(item?.summary, ""),
  }));
}

function buildObservationLinks(context = {}) {
  const links = context.links && typeof context.links === "object" ? context.links : {};

  return {
    runtime_report_path: normalizeText(context.runtimeReportPath || links.runtime_report_path),
    related_commit_sha: normalizeText(context.relatedCommitSha || context.commitSha || links.related_commit_sha),
    related_run_id: normalizeText(context.relatedRunId || context.runId || links.related_run_id),
  };
}

export function buildDiagnosticsObservationEventInput(diagnosticsResult = {}, context = {}) {
  const report = diagnosticsResult.report || {};
  const results = Array.isArray(report.results) ? report.results : [];
  const failed = results.filter((item) => !item?.ok);
  const checkTypes = results.map((item) => normalizeText(item?.type, "unknown"));
  const ok = Boolean(diagnosticsResult.ok);

  return {
    event_id: `diagnostics_${Date.now()}`,
    event_type: OBSERVATION_EVENT_TYPES.DIAGNOSTICS_RESULT,
    source: {
      system: "sg",
      transport: "internal",
      module: "diagnosticsObservationBridge",
    },
    actor: {
      role: safeActorRole(context),
      user_ref: safeActorUserRef(context),
      chat_ref: "redacted",
    },
    direction: OBSERVATION_DIRECTIONS.INTERNAL,
    summary: ok
      ? `Diagnostics completed successfully: ${results.length} checks.`
      : `Diagnostics completed with failures: ${failed.length}/${results.length} checks failed.`,
    payload: {
      diagnostics_ok: ok,
      checks_count: results.length,
      failed_count: failed.length,
      check_types: checkTypes,
      results: summarizeResults(results),
      report_type: normalizeText(report.type, "diagnostics_report"),
      plan_mode: normalizeText(diagnosticsResult.plan?.mode || report.plan?.mode, "read_only"),
    },
    policy: {
      sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
      retention: OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: true,
      memory_candidate: false,
    },
    links: buildObservationLinks(context),
  };
}

export async function produceDiagnosticsObservationLatest(diagnosticsResult = {}, context = {}) {
  const eventInput = buildDiagnosticsObservationEventInput(diagnosticsResult, context);

  return produceObservationLatest({
    name: "diagnostics-latest",
    eventInput,
    summary: eventInput.summary,
  });
}

export default {
  buildDiagnosticsObservationEventInput,
  produceDiagnosticsObservationLatest,
};
