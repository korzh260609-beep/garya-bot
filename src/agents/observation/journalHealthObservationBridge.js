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

async function refreshDiagnosticsIfNeeded(reportNames) {
  if (!reportNames.includes("diagnostics-latest")) {
    return null;
  }

  const plan = buildDiagnosticsPlan({
    text: "observation journal health latest refresh",
    checks: JOURNAL_HEALTH_DIAGNOSTICS_CHECKS,
  });
  const results = await runDiagnosticsChecks({
    checks: plan.checks,
    text: plan.text,
    repo: getCurrentProjectRepository(),
    branch: getCurrentProjectBranch(),
    target: "garya-bot",
    workflow: "sg2-smoke.yml",
    logLimit: 100,
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
  });
}

async function refreshRuntimeStatusIfNeeded(reportNames) {
  if (!reportNames.includes("runtime-status-latest")) {
    return null;
  }

  return produceRuntimeStatusObservationLatest();
}

export async function produceObservationJournalHealthLatest(input = {}) {
  const reportNames = Array.isArray(input.reportNames) && input.reportNames.length > 0
    ? input.reportNames.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
    : DEFAULT_HEALTH_REPORT_NAMES;

  await refreshDiagnosticsIfNeeded(reportNames);
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
    },
    policy: {
      sensitivity: OBSERVATION_SENSITIVITY.INTERNAL,
      retention: OBSERVATION_RETENTION.LATEST_ONLY,
      sanitized: true,
      memory_candidate: false,
    },
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
