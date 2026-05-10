// AGENT NOTE:
// SG 2.0 Observation journal status diagnostics check.
// Purpose: read sanitized latest observation reports and summarize journal state for the monarch.
// Do not add Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, or autonomous behavior here.

import { readObservationLatestReport } from "../agents/observation/observationReader.js";

const DEFAULT_REPORT_NAMES = [
  "diagnostics-latest",
  "runtime-status-latest",
];

function summarizeReportRead(name, result = {}) {
  if (!result.ok) {
    return {
      name,
      ok: false,
      path: result.path || "",
      summary: result.error || result.reason || "observation_report_unavailable",
    };
  }

  const report = result.report || {};
  const event = report.event || {};

  return {
    name,
    ok: true,
    path: result.path || "",
    eventType: event.event_type || "unknown",
    summary: report.summary || event.summary || "Observation report available.",
    generatedAt: report.generated_at || event.created_at || "",
    sensitivity: event.policy?.sensitivity || "unknown",
    sanitized: Boolean(event.policy?.sanitized),
  };
}

export async function runObservationJournalStatusCheck(input = {}) {
  const reportNames = Array.isArray(input.reportNames) && input.reportNames.length > 0
    ? input.reportNames.filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim())
    : DEFAULT_REPORT_NAMES;

  const reports = [];

  for (const name of reportNames) {
    const result = await readObservationLatestReport({ name });
    reports.push(summarizeReportRead(name, result));
  }

  const available = reports.filter((item) => item.ok);
  const missing = reports.filter((item) => !item.ok);

  return {
    ok: missing.length === 0,
    type: "observation_journal_status_check",
    reports_checked: reports.length,
    reports_available: available.length,
    reports_missing: missing.length,
    reports,
    summary: missing.length === 0
      ? `Observation journal available: ${available.length}/${reports.length} reports.`
      : `Observation journal partially available: ${available.length}/${reports.length} reports. Missing: ${missing.map((item) => item.name).join(", ")}.`,
  };
}

export default {
  runObservationJournalStatusCheck,
};
