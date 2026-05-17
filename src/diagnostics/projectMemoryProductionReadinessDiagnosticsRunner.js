// SG 2.0 Project Memory production readiness diagnostics runner.
// Purpose: run the dedicated Project Memory production readiness diagnostics suite with live DB metadata and provided safe runtime/deploy evidence.
// This runner does not write DB, Project Memory, runtime files, repository state, env, Telegram, or AI outputs.
// It must not claim production readiness unless the underlying check returns ready=true from verified evidence.

import { runProjectMemoryLiveDbCheck } from "./projectMemoryLiveDbCheck.js";
import { runProjectMemoryRuntimeCheck } from "./projectMemoryRuntimeCheck.js";
import { runProjectMemoryProductionReadinessCheck } from "./projectMemoryProductionReadinessCheck.js";
import {
  getProjectMemoryProductionReadinessDiagnosticsChecks,
  PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
} from "./projectMemoryProductionReadinessDiagnosticsSuite.js";

export const PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_RUNNER_VERSION = 1;

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function runtimeCheckToReadinessRuntimeEvidence(runtimeCheck = {}, providedRuntime = {}) {
  const safeProvided = normalizePlainObject(providedRuntime);
  const details = normalizePlainObject(runtimeCheck.details);

  return {
    candidateCreationTestedSafely: normalizeBoolean(safeProvided.candidateCreationTestedSafely),
    confirmationTestedSafely: normalizeBoolean(safeProvided.confirmationTestedSafely),
    confirmedReadTestedSafely: normalizeBoolean(safeProvided.confirmedReadTestedSafely),
    restoreContextTested: normalizeBoolean(safeProvided.restoreContextTested),
    featureFlagsVerifiedSafe: normalizeBoolean(safeProvided.featureFlagsVerifiedSafe, runtimeCheck.ok === true),
    countsVerified: normalizeBoolean(safeProvided.countsVerified),
    candidateCount: Number.isInteger(safeProvided.candidateCount) ? safeProvided.candidateCount : 0,
    confirmedCount: Number.isInteger(safeProvided.confirmedCount) ? safeProvided.confirmedCount : 0,
    staleCount: Number.isInteger(safeProvided.staleCount) ? safeProvided.staleCount : 0,
    conflictCount: Number.isInteger(safeProvided.conflictCount) ? safeProvided.conflictCount : 0,
    featureFlags: {
      readEnabled: details.projectMemoryReadEnabled === true,
      writeEnabled: false,
      sourceSyncEnabled: false,
      autoConfirmEnabled: false,
      promptInjectionEnabled: details.promptInjectionEnabled === true,
    },
    readGate: {
      enabled: details.projectMemoryReadEnabled === true,
      confirmedOnly: true,
      bounded: true,
      summary: runtimeCheck.summary || "Project Memory runtime check summary not available.",
    },
    writeGate: {
      enabled: false,
      candidateOnly: true,
      requiresConfirmation: true,
      summary: "Project Memory production readiness runner does not enable writes.",
    },
    restoreEntryCount: Number.isInteger(safeProvided.restoreEntryCount) ? safeProvided.restoreEntryCount : 0,
    restoreCharCount: Number.isInteger(safeProvided.restoreCharCount) ? safeProvided.restoreCharCount : 0,
    staleOrConflictLabelsPresent: normalizeBoolean(safeProvided.staleOrConflictLabelsPresent),
    restoreSummary: normalizeText(safeProvided.restoreSummary) || "restore_context_runtime_evidence_not_provided",
  };
}

function buildReport({ checks, runtimeCheck, liveDbCheck, readinessCheck }) {
  const results = [
    {
      ok: Boolean(runtimeCheck.ok),
      type: "project_memory_runtime",
      summary: runtimeCheck.summary || "Project Memory runtime check did not provide summary.",
      data: runtimeCheck,
    },
    {
      ok: Boolean(liveDbCheck.ok),
      type: "project_memory_live_db",
      summary: liveDbCheck.summary || "Project Memory live DB check did not provide summary.",
      data: liveDbCheck,
    },
    {
      ok: Boolean(readinessCheck.ok),
      type: "project_memory_production_readiness",
      summary: readinessCheck.summary || "Project Memory production readiness check did not provide summary.",
      data: readinessCheck,
    },
  ];

  return {
    ok: results.every((item) => item.ok),
    type: "sg_diagnostics_report",
    mode: "read_only",
    suite: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
    checks,
    results,
  };
}

export function getProjectMemoryProductionReadinessDiagnosticsRunnerStatus() {
  return {
    ok: true,
    type: "project_memory_production_readiness_diagnostics_runner_status",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_RUNNER_VERSION,
    suite: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
    checks: getProjectMemoryProductionReadinessDiagnosticsChecks(),
    readOnly: true,
    writesDatabase: false,
    writesProjectMemory: false,
    writesRuntimeFiles: false,
    writesRepository: false,
    changesEnvironment: false,
    touchesTelegram: false,
    callsAI: false,
    fetchesGitHub: false,
    fetchesRender: false,
    canClaimReadinessWithoutVerifiedEvidence: false,
  };
}

export async function runProjectMemoryProductionReadinessDiagnostics({
  runtime = {},
  evidence = {},
  liveDbCheck = null,
  runtimeCheck = null,
} = {}) {
  const checks = getProjectMemoryProductionReadinessDiagnosticsChecks();
  const safeEvidence = normalizePlainObject(evidence);
  const runtimeResult = runtimeCheck || runProjectMemoryRuntimeCheck();
  const liveDbResult = liveDbCheck || await runProjectMemoryLiveDbCheck();
  const readinessRuntimeEvidence = runtimeCheckToReadinessRuntimeEvidence(runtimeResult, runtime);
  const readinessResult = await runProjectMemoryProductionReadinessCheck({
    runtime: readinessRuntimeEvidence,
    evidence: safeEvidence,
    liveDbCheck: liveDbResult,
  });
  const report = buildReport({
    checks,
    runtimeCheck: runtimeResult,
    liveDbCheck: liveDbResult,
    readinessCheck: readinessResult,
  });

  return {
    ok: report.ok,
    type: "project_memory_production_readiness_diagnostics_result",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_RUNNER_VERSION,
    suite: PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_SUITE_NAME,
    ready: readinessResult.ready === true,
    summary: readinessResult.ready === true
      ? "Project Memory production readiness verified by live diagnostics and provided evidence."
      : "Project Memory production readiness is not established by current live diagnostics/evidence.",
    report,
    sanitized: true,
    readOnly: true,
    status: getProjectMemoryProductionReadinessDiagnosticsRunnerStatus(),
  };
}

export default {
  PROJECT_MEMORY_PRODUCTION_READINESS_DIAGNOSTICS_RUNNER_VERSION,
  getProjectMemoryProductionReadinessDiagnosticsRunnerStatus,
  runProjectMemoryProductionReadinessDiagnostics,
};
