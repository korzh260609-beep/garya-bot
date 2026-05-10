// AGENT NOTE:
// SG 2.0 Observation latest-report diagnostic check.
// Purpose: verify SG can read the latest sanitized observation report.
// Do not add Telegram integration, AI calls, memory reads/writes, raw log output, or autonomous behavior here.

import { readObservationLatestReport } from "../agents/observation/observationReader.js";

function normalizeText(value, fallback = "") {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text || fallback;
}

function buildSafeResult(data = {}) {
  return {
    ok: Boolean(data.ok),
    type: "observation_latest_report",
    readable: Boolean(data.readable),
    reportName: normalizeText(data.reportName, "diagnostics-latest"),
    path: normalizeText(data.path, ""),
    eventsCount: Number.isFinite(Number(data.eventsCount)) ? Number(data.eventsCount) : 0,
    invalidEventsCount: Number.isFinite(Number(data.invalidEventsCount)) ? Number(data.invalidEventsCount) : 0,
    reportType: normalizeText(data.reportType, ""),
    generatedAt: normalizeText(data.generatedAt, ""),
    rawPayloadExposed: false,
    summary: normalizeText(data.summary, "Observation latest report check completed."),
    error: data.error || null,
  };
}

export async function runObservationLatestReportCheck({ name = "diagnostics-latest" } = {}) {
  const reportName = normalizeText(name, "diagnostics-latest");
  const result = await readObservationLatestReport({ name: reportName });

  if (!result.ok) {
    return buildSafeResult({
      ok: false,
      readable: false,
      reportName,
      path: result.path,
      error: result.reason || result.error || "observation_latest_report_unavailable",
      summary: `Observation latest report unavailable: ${result.reason || result.error || "unknown"}.`,
    });
  }

  const report = result.report || {};
  const eventsCount = Number(report.events_count || 0);
  const invalidEventsCount = Number(report.invalid_events_count || 0);
  const ok = report.type === "observation_report" && invalidEventsCount === 0;

  return buildSafeResult({
    ok,
    readable: true,
    reportName,
    path: result.path,
    eventsCount,
    invalidEventsCount,
    reportType: report.type,
    generatedAt: report.generated_at,
    summary: ok
      ? `Observation latest report is readable: ${eventsCount} events, ${invalidEventsCount} invalid.`
      : `Observation latest report is readable but invalid: type=${report.type || "unknown"}, invalid=${invalidEventsCount}.`,
    error: ok ? null : "observation_latest_report_invalid",
  });
}

export default {
  runObservationLatestReportCheck,
};
