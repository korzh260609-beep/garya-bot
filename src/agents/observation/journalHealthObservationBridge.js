// AGENT NOTE:
// SG 2.0 Observation Journal Health bridge.
// Purpose: produce a sanitized latest-only observation journal health report through trigger flow.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or code/env mutations here.

import {
  createObservationEvent,
  OBSERVATION_ACTOR_ROLES,
  OBSERVATION_DIRECTIONS,
  OBSERVATION_EVENT_TYPES,
  OBSERVATION_RETENTION,
  OBSERVATION_SENSITIVITY,
} from "./eventSchema.js";
import { readObservationLatestReport } from "./observationReader.js";
import { writeObservationLatestReport } from "./observationWriter.js";
import { produceRuntimeStatusObservationLatest } from "./runtimeStatusObservationBridge.js";
import { produceDiagnosticsObservationLatest } from "../../diagnostics/diagnosticsObservationBridge.js";
import { runDiagnosticsChecks } from "../../diagnostics/diagnosticsChecksRunner.js";
import { buildDiagnosticsPlan } from "../../diagnostics/diagnosticsPlan.js";
import { buildDiagnosticsReport } from "../../diagnostics/diagnosticsReport.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

const DEFAULT_HEALTH_REPORT_NAMES = [
  "diagnostics-latest",
  "runtime-status-latest",
];

const JOURNAL_HEALTH_DIAGNOSTICS_CHECKS = [
  "observation_journal_health_latest",
];

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text || fallback;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function buildObservationLinks(input = {}) {
  const links = input.links && typeof input.links === "object" ? input.links : {};

  return {
    runtime_report_path: normalizeText(input.runtimeReportPath || links.runtime_report_path),
    related_commit_sha: normalizeText(input.relatedCommitSha || input.commitSha || links.related_commit_sha),
    related_run_id: normalizeText(input.relatedRunId || input.runId || links.related_run_id),
  };
}

function buildDiagnosticsChecks(input = {}) {
  return uniqueStrings([
    ...JOURNAL_HEALTH_DIAGNOSTICS_CHECKS,
    ...normalizeStringArray(input.diagnosticsChecks),
  ]);
}

function summarizeJournalRead(name, result = {}) {
  if (!result.ok) {
    return {
      name,
      ok: false,
      summary: result.error || result.reason || "observation_report_unavailable",
    };
  }

  const report = result.report || {};
  const event = report.event || report.events?.[0] || {};

  return {
    name,
    ok: true,
    eventType: event.event_type || "unknown",
    summary: report.summary || event.summary || "Observation report available.",
    generatedAt: report.generated_at || event.created_at || "",
    sanitized: Boolean(report.policy?.sanitized ?? event.policy?.sanitized),
  };
}

async function refreshDiagnosticsIfNeeded(reportNames, input = {}) {
  if (!reportNames.includes("diagnostics-latest")) {
    return null;
  }

  const diagnosticsChecks = buildDiagnosticsChecks(input);
  const links = buildObservationLinks(input);
  const plan = buildDiagnosticsPlan({
    text: links.related_commit_sha
      ? `observation journal health latest refresh for commit ${links.related_commit_sha.slice(0, 12)}`
      : "observation journal health latest refresh",
    checks: diagnosticsChecks,
  });
  const results = await runDiagnosticsChecks({
    checks: plan.checks,
    text: plan.text,
    repo: getCurrentProjectRepository(),
    branch: getCurrentProjectBranch(),
    target: "garya-bot",
    workflow: "sg2-smoke.yml",
    logLimit: 100,
    commitSha: links.related_commit_sha,
  });
  const report = buildDiagnosticsReport({
    plan,
    results,
  });

  return produceDiagnosticsObservationLatest({
    ok: report.ok,
    type: "sg_diagnostics_check",
    mode: "runtime_orchestration",
    text: plan.text,
    intent: {},
    plan,
    report,
    finalText: "Diagnostics latest refreshed for observation journal health.",
  }, {
    isMonarch: false,
    links,
  });
}

async function refreshRuntimeStatusIfNeeded(reportNames) {
  if (!reportNames.includes("runtime-status-latest")) {
    return null;
  }

  return produceRuntimeStatusObservationLatest();
}

export async function produceObservationJournalHealthLatest(input = {}) {
  const reportNames = normalizeStringArray(input.reportNames).length > 0
    ? normalizeStringArray(input.reportNames)
    : DEFAULT_HEALTH_REPORT_NAMES;
  const links = buildObservationLinks(input);

  await refreshDiagnosticsIfNeeded(reportNames, input);
  await refreshRuntimeStatusIfNeeded(reportNames);

  const reports = [];

  for (const name of reportNames) {
    const result = await readObservationLatestReport({ name });
    reports.push(summarizeJournalRead(name, result));
  }

  const available = reports.filter((item) => item.ok);
  const missing = reports.filter((item) => !item.ok);
  const summary = missing.length === 0
    ? `Observation journal health OK: ${available.length}/${reports.length} reports available.`
    : `Observation journal health degraded: ${available.length}/${reports.length} reports available.`;

  const event = createObservationEvent({
    event_type: OBSERVATION_EVENT_TYPES.OBSERVATION_JOURNAL_HEALTH,
    source: {
      system: "sg",
      transport: "internal",
      module: "observation-journal-health",
    },
    actor: {
      role: OBSERVATION_ACTOR_ROLES.SYSTEM,
      user_ref: "redacted",
      chat_ref: "redacted",
    },
    direction: OBSERVATION_DIRECTIONS.INTERNAL,
    summary,
    payload: {
      reports_checked: reports.length,
      reports_available: available.length,
      reports_missing: missing.length,
      reports,
      diagnostics_checks: buildDiagnosticsChecks(input),
    },
    policy: {
      sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
      retention: OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: true,
      memory_candidate: false,
    },
    links,
  });

  return writeObservationLatestReport({
    name: "observation-journal-health-latest",
    events: [event],
    summary,
  });
}

export default {
  produceObservationJournalHealthLatest,
};
