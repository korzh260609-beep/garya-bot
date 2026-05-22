// AGENT NOTE:
// SG 2.0 Diagnostics Layer runner.
// Purpose: provide a bounded public diagnostics entry point without coupling diagnostics to Telegram or core message handling.
// Diagnostics may collect generated runtime reports, but must not mutate code, env, Render settings, GitHub settings, or transport logic.

import {
  OBSERVATION_TRIGGER_NAMES,
  runObservationTrigger,
} from "../agents/observation/triggers/index.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../tools/github/githubProjectDefaults.js";
import { runDiagnosticsChecks } from "./diagnosticsChecksRunner.js";
import { detectDiagnosticsIntent } from "./diagnosticsIntent.js";
import { buildDiagnosticsPlan } from "./diagnosticsPlan.js";
import { buildDiagnosticsReport } from "./diagnosticsReport.js";

const PROJECT_MEMORY_ENTRY_LOOKUP_CHECK = "project_memory_entry_lookup";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
}

function normalizePositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function readNumberAfterMarker(text, marker) {
  const safeText = normalizeString(text);
  const safeMarker = normalizeString(marker).toLowerCase();
  if (!safeText || !safeMarker) return null;

  const lower = safeText.toLowerCase();
  let searchFrom = 0;

  while (searchFrom < lower.length) {
    const markerIndex = lower.indexOf(safeMarker, searchFrom);
    if (markerIndex < 0) return null;

    let cursor = markerIndex + safeMarker.length;
    while (cursor < safeText.length && " #:=/-".includes(safeText[cursor])) {
      cursor += 1;
    }

    let digits = "";
    while (cursor < safeText.length && safeText[cursor] >= "0" && safeText[cursor] <= "9") {
      digits += safeText[cursor];
      cursor += 1;
    }

    const parsed = normalizePositiveInteger(digits);
    if (parsed) return parsed;

    searchFrom = markerIndex + safeMarker.length;
  }

  return null;
}

function extractProjectMemoryEntryLookupArguments({ text, checks }) {
  const safeChecks = Array.isArray(checks) ? checks : [];
  if (!safeChecks.includes(PROJECT_MEMORY_ENTRY_LOOKUP_CHECK)) return {};

  const prNumber = readNumberAfterMarker(text, "prNumber")
    || readNumberAfterMarker(text, "PR")
    || readNumberAfterMarker(text, "pull");

  return prNumber ? { prNumber } : {};
}

function formatProjectMemoryCountsDetails(item = {}) {
  const details = item?.data?.details || {};
  const groupedCounts = Array.isArray(details.groupedCounts) ? details.groupedCounts : [];
  const groupedWriteAuditCounts = Array.isArray(details.groupedWriteAuditCounts)
    ? details.groupedWriteAuditCounts
    : [];

  const lines = [
    "",
    "Project Memory counts:",
    `- totalEntries: ${details.totalEntries ?? "unknown"}`,
    `- sgConfirmedActiveCount: ${details.sgConfirmedActiveCount ?? "unknown"}`,
    `- sgPendingCandidateCount: ${details.sgPendingCandidateCount ?? "unknown"}`,
    `- writeAuditTotal: ${details.writeAuditTotal ?? "unknown"}`,
  ];

  if (groupedCounts.length > 0) {
    lines.push("- groupedCounts:");

    for (const row of groupedCounts) {
      lines.push(
        `  - projectKey=${row.projectKey || "unknown"} / trust=${row.trust || "unknown"} / status=${row.status || "unknown"} / count=${row.count ?? "unknown"}`
      );
    }
  }

  if (groupedWriteAuditCounts.length > 0) {
    lines.push("- groupedWriteAuditCounts:");

    for (const row of groupedWriteAuditCounts) {
      lines.push(
        `  - action=${row.action || "unknown"} / decision=${row.decision || "unknown"} / count=${row.count ?? "unknown"}`
      );
    }
  }

  return lines;
}

function formatListPreview(value = [], max = 6) {
  if (!Array.isArray(value) || value.length === 0) return "none";
  const items = value.map((item) => normalizeString(item)).filter(Boolean);
  if (items.length === 0) return "none";
  const visible = items.slice(0, max).join(", ");
  return items.length > max ? `${visible}, ...` : visible;
}

function formatPatternKeys(patterns = []) {
  if (!Array.isArray(patterns) || patterns.length === 0) return "none";
  return patterns
    .map((pattern) => normalizeString(pattern?.key || pattern?.field))
    .filter(Boolean)
    .join(", ") || "none";
}

function formatJsonShape(value = null) {
  if (!value || typeof value !== "object") return "none";
  try {
    return JSON.stringify(value);
  } catch {
    return "unserializable";
  }
}

function formatLookupMatchPreview(label, entry = null) {
  if (!entry || typeof entry !== "object") {
    return [`- ${label}: none`];
  }

  return [
    `- ${label}:`,
    `  - projectKey: ${entry.projectKey || "unknown"}`,
    `  - trust: ${entry.trust || "unknown"}`,
    `  - status: ${entry.status || "unknown"}`,
    `  - sourceType: ${entry.sourceType || "unknown"}`,
    `  - sourceRef: ${entry.sourceRef || "unknown"}`,
    `  - traceId: ${entry.traceId || "unknown"}`,
    `  - confirmedAt: ${entry.confirmedAt || "unknown"}`,
    `  - metadataKeys: ${formatListPreview(entry.metadataKeys)}`,
    `  - metadataShape: ${formatJsonShape(entry.metadataShape)}`,
  ];
}

function formatProjectMemoryEntryLookupDetails(item = {}) {
  const details = item?.data?.details || {};
  const entries = Array.isArray(details.entries) ? details.entries : [];
  const exactMatches = Array.isArray(details.exactMatches) ? details.exactMatches : entries;
  const nearMatches = Array.isArray(details.nearMatches) ? details.nearMatches : [];
  const firstEntry = exactMatches[0] || entries[0] || {};
  const firstNearMatch = nearMatches[0] || null;
  const queryPatterns = details.queryPatternsApplied || {};

  const lines = [
    "",
    "Project Memory entry lookup:",
    `- requestedPrNumber: ${details.requestedPrNumber ?? details.prNumber ?? "unknown"}`,
    `- databaseConfigured: ${details.databaseConfigured ?? "unknown"}`,
    `- checked: ${details.checked ?? "unknown"}`,
    `- found: ${details.found ?? false}`,
    `- confirmedActiveFound: ${details.confirmedActiveFound ?? false}`,
    `- exactMatches: ${exactMatches.length}`,
    `- nearMatches: ${nearMatches.length}`,
    `- exactPatterns: ${formatPatternKeys(queryPatterns.exactPatternsApplied)}`,
    `- nearPatterns: ${formatPatternKeys(queryPatterns.nearPatternsApplied)}`,
    ...formatLookupMatchPreview("firstExactMatch", firstEntry?.id ? firstEntry : null),
    ...formatLookupMatchPreview("firstNearMatch", firstNearMatch),
  ];

  return lines;
}

function getStructuredIntent(input = {}, context = {}) {
  const inputIntent = input.intent && typeof input.intent === "object" && !Array.isArray(input.intent)
    ? input.intent
    : null;
  const contextIntent = context.intent && typeof context.intent === "object" && !Array.isArray(context.intent)
    ? context.intent
    : null;

  return inputIntent || contextIntent || null;
}

async function safeRunObservationTrigger(input = {}, fallbackType = "observation_trigger_result") {
  try {
    return await runObservationTrigger(input);
  } catch (error) {
    return {
      ok: false,
      type: fallbackType,
      error: error?.message || "observation_trigger_failed",
    };
  }
}

async function safePublishDiagnosticsObservation(diagnosticsResult, context) {
  const result = await safeRunObservationTrigger({
    name: OBSERVATION_TRIGGER_NAMES.DIAGNOSTICS_FINISHED,
    payload: {
      diagnosticsResult,
    },
    context,
  }, "diagnostics_observation_publish_result");

  return {
    ok: Boolean(result?.ok),
    type: "diagnostics_observation_publish_result",
    observation: result?.observation || result,
  };
}

async function safePublishRuntimeStatusObservation() {
  const result = await safeRunObservationTrigger({
    name: OBSERVATION_TRIGGER_NAMES.RUNTIME_STATUS_REQUESTED,
  }, "runtime_status_observation_publish_result");

  return {
    ok: Boolean(result?.ok),
    type: "runtime_status_observation_publish_result",
    observation: result?.observation || result,
  };
}

function buildSkippedObservation(type) {
  return {
    ok: true,
    type,
    skipped: true,
    reason: "diagnostics_observation_skipped_by_context",
  };
}

function buildFinalDiagnosticsText({ report }) {
  const results = Array.isArray(report?.results) ? report.results : [];
  const failed = results.filter((item) => !item.ok);
  const projectMemoryCountsBlocks = results
    .filter((item) => item.type === "project_memory_counts")
    .flatMap((item) => formatProjectMemoryCountsDetails(item));
  const projectMemoryEntryLookupBlocks = results
    .filter((item) => item.type === PROJECT_MEMORY_ENTRY_LOOKUP_CHECK)
    .flatMap((item) => formatProjectMemoryEntryLookupDetails(item));

  const lines = [
    "Диагностика SG выполнена.",
    "",
    "Проверено:",
    ...results.map((item) => `- ${item.type}: ${item.ok ? "OK" : "FAIL"} — ${item.summary}`),
    ...projectMemoryCountsBlocks,
    ...projectMemoryEntryLookupBlocks,
    "",
    failed.length > 0
      ? `Проблемные проверки: ${failed.map((item) => item.type).join(", ")}.`
      : "Явных сбоев по собранным проверкам не найдено.",
    "",
    `Следующий шаг: ${report?.nextStep || "проверить детали failed-проверок перед изменением кода."}`,
  ];

  return lines.join("\n").trim();
}

export async function runDiagnosticsCheck(input = {}, context = {}) {
  if (!context?.isMonarch) {
    return {
      ok: false,
      type: "sg_diagnostics_check",
      error: "sg_diagnostics_not_allowed",
      finalText: "Диагностика доступна только монарху.",
    };
  }

  const text = typeof input.text === "string" && input.text.trim()
    ? input.text.trim()
    : String(context.latestUserText || "").trim();
  const structuredIntent = getStructuredIntent(input, context);
  const intent = detectDiagnosticsIntent({ text, intent: structuredIntent });
  const plan = buildDiagnosticsPlan({
    text,
    intent: intent.intent,
    checks: input.checks,
  });
  const repo = normalizeString(input.repo) || getCurrentProjectRepository();
  const branch = normalizeString(input.branch) || getCurrentProjectBranch();
  const target = normalizeString(input.target) || "garya-bot";
  const workflow = normalizeString(input.workflow) || "sg2-smoke.yml";
  const logLimit = normalizeLimit(input.limit, 100);

  const checks = Array.isArray(plan.checks) ? plan.checks : [];
  const diagnosticsArguments = extractProjectMemoryEntryLookupArguments({ text, checks });
  const runChecks = typeof context.runDiagnosticsChecksFn === "function"
    ? context.runDiagnosticsChecksFn
    : runDiagnosticsChecks;
  const results = await runChecks({
    checks,
    text,
    repo,
    branch,
    target,
    workflow,
    logLimit,
    ...diagnosticsArguments,
  });

  const report = buildDiagnosticsReport({
    plan,
    results,
  });
  const finalText = buildFinalDiagnosticsText({ report });
  const diagnosticsResult = {
    ok: report.ok,
    type: "sg_diagnostics_check",
    mode: "runtime_orchestration",
    text,
    intent,
    plan,
    report,
    finalText,
  };
  const skipObservation = context.skipDiagnosticsObservation === true;
  const observation = skipObservation
    ? buildSkippedObservation("diagnostics_observation_publish_result")
    : await safePublishDiagnosticsObservation(diagnosticsResult, context);
  const runtimeObservation = skipObservation
    ? buildSkippedObservation("runtime_status_observation_publish_result")
    : await safePublishRuntimeStatusObservation();

  return {
    ...diagnosticsResult,
    observation,
    runtimeObservation,
  };
}
