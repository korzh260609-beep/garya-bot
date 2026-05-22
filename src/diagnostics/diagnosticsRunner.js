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
  const markerIndex = lower.indexOf(safeMarker);
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

  return normalizePositiveInteger(digits);
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

function buildFinalDiagnosticsText({ report }) {
  const results = Array.isArray(report?.results) ? report.results : [];
  const failed = results.filter((item) => !item.ok);
  const projectMemoryCountsBlocks = results
    .filter((item) => item.type === "project_memory_counts")
    .flatMap((item) => formatProjectMemoryCountsDetails(item));

  const lines = [
    "Диагностика SG выполнена.",
    "",
    "Проверено:",
    ...results.map((item) => `- ${item.type}: ${item.ok ? "OK" : "FAIL"} — ${item.summary}`),
    ...projectMemoryCountsBlocks,
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
  const observation = await safePublishDiagnosticsObservation(diagnosticsResult, context);
  const runtimeObservation = await safePublishRuntimeStatusObservation();

  return {
    ...diagnosticsResult,
    observation,
    runtimeObservation,
  };
}
