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

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLimit(value, fallback = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(1000, Math.trunc(n)));
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

  const lines = [
    "Диагностика SG выполнена.",
    "",
    "Проверено:",
    ...results.map((item) => `- ${item.type}: ${item.ok ? "OK" : "FAIL"} — ${item.summary}`),
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
  const intent = detectDiagnosticsIntent({ text });
  const plan = buildDiagnosticsPlan({
    text,
    intent,
    checks: input.checks,
  });
  const repo = normalizeString(input.repo) || getCurrentProjectRepository();
  const branch = normalizeString(input.branch) || getCurrentProjectBranch();
  const target = normalizeString(input.target) || "garya-bot";
  const workflow = normalizeString(input.workflow) || "sg2-smoke.yml";
  const logLimit = normalizeLimit(input.limit, 100);

  const checks = Array.isArray(plan.checks) ? plan.checks : [];
  const results = await runDiagnosticsChecks({
    checks,
    text,
    repo,
    branch,
    target,
    workflow,
    logLimit,
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
