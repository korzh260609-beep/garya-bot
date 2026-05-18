// scripts/runProjectMemoryProductionReadinessDiagnostics.js
// SG 2.0 Project Memory production readiness runtime entrypoint.
// Purpose: manually run the read-only Project Memory production readiness diagnostics in a live runtime environment.
// Intended use: Render Shell/Job or controlled local runtime, never as autonomous cron.
// This script does not write DB, Project Memory, runtime files, repository state, env, Telegram, or AI outputs.

import { runProjectMemoryProductionReadinessDiagnostics } from "../src/diagnostics/projectMemoryProductionReadinessDiagnosticsRunner.js";

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function envInt(name, fallback = 0) {
  const value = Number.parseInt(String(process.env[name] || ""), 10);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function envText(name, fallback = "") {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
}

function buildRuntimeEvidenceFromEnv() {
  return {
    candidateCreationTestedSafely: envBool("PM_READY_CANDIDATE_CREATION_TESTED_SAFELY"),
    confirmationTestedSafely: envBool("PM_READY_CONFIRMATION_TESTED_SAFELY"),
    confirmedReadTestedSafely: envBool("PM_READY_CONFIRMED_READ_TESTED_SAFELY"),
    restoreContextTested: envBool("PM_READY_RESTORE_CONTEXT_TESTED"),
    featureFlagsVerifiedSafe: envBool("PM_READY_FEATURE_FLAGS_VERIFIED_SAFE"),
    countsVerified: envBool("PM_READY_COUNTS_VERIFIED"),
    candidateCount: envInt("PM_READY_CANDIDATE_COUNT"),
    confirmedCount: envInt("PM_READY_CONFIRMED_COUNT"),
    staleCount: envInt("PM_READY_STALE_COUNT"),
    conflictCount: envInt("PM_READY_CONFLICT_COUNT"),
    restoreEntryCount: envInt("PM_READY_RESTORE_ENTRY_COUNT"),
    restoreCharCount: envInt("PM_READY_RESTORE_CHAR_COUNT"),
    staleOrConflictLabelsPresent: envBool("PM_READY_STALE_OR_CONFLICT_LABELS_PRESENT"),
    restoreSummary: envText("PM_READY_RESTORE_SUMMARY", "runtime_entrypoint_restore_summary_not_provided"),
  };
}

function buildDeployEvidenceFromEnv() {
  return {
    rollbackPoint: envText("PM_READY_ROLLBACK_POINT"),
    deployDone: envBool("PM_READY_DEPLOY_DONE"),
    renderLogsClean: envBool("PM_READY_RENDER_LOGS_CLEAN"),
  };
}

function sanitizeForCli(value) {
  const text = JSON.stringify(value, null, 2);
  return text
    .replace(/postgres:\/\/[^\s"']+/gi, "postgres://redacted")
    .replace(/DATABASE_URL\s*=\s*[^\s"']+/gi, "DATABASE_URL=redacted")
    .replace(/RENDER_API_KEY\s*=\s*[^\s"']+/gi, "RENDER_API_KEY=redacted")
    .replace(/OPENAI_API_KEY\s*=\s*[^\s"']+/gi, "OPENAI_API_KEY=redacted");
}

const explicitRequest = envBool("PM_READY_EXPLICIT_RUNTIME_CHECK");

if (!explicitRequest) {
  console.log(JSON.stringify({
    ok: false,
    type: "project_memory_production_readiness_runtime_entrypoint_result",
    reason: "missing_explicit_runtime_check_request",
    requiredEnv: "PM_READY_EXPLICIT_RUNTIME_CHECK=true",
    readOnly: true,
    writesDatabase: false,
    writesProjectMemory: false,
    writesRuntimeFiles: false,
    writesRepository: false,
    touchesTelegram: false,
    callsAI: false,
  }, null, 2));
  process.exit(1);
}

try {
  const result = await runProjectMemoryProductionReadinessDiagnostics({
    runtime: buildRuntimeEvidenceFromEnv(),
    evidence: buildDeployEvidenceFromEnv(),
  });

  console.log(sanitizeForCli({
    ok: result.ok,
    type: "project_memory_production_readiness_runtime_entrypoint_result",
    ready: result.ready,
    summary: result.summary,
    report: result.report,
    readOnly: true,
    sanitized: true,
  }));

  process.exit(result.ready === true ? 0 : 1);
} catch (error) {
  console.error(sanitizeForCli({
    ok: false,
    type: "project_memory_production_readiness_runtime_entrypoint_error",
    error: error?.message || String(error),
    readOnly: true,
    sanitized: true,
  }));
  process.exit(1);
}
