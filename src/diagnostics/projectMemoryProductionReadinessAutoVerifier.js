// SG 2.0 Project Memory production readiness automatic verifier.
// Purpose: automatically run Project Memory production readiness diagnostics from trusted deploy/runtime evidence.
// This is not a user/shell command path. It is intended for SG runtime orchestration after deploy/observation evidence.
// This verifier is read-only and fail-closed: it must not claim ready without complete trusted evidence.

import { runProjectMemoryProductionReadinessDiagnostics } from "./projectMemoryProductionReadinessDiagnosticsRunner.js";

export const PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_VERSION = 1;

export const PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_DECISIONS = Object.freeze({
  VERIFIED_READY: "project_memory_production_readiness_verified_ready",
  NOT_READY: "project_memory_production_readiness_not_ready",
  REJECTED: "project_memory_production_readiness_auto_verification_rejected",
});

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeBoolean(value) {
  return value === true;
}

function buildRejected(reason, extra = {}) {
  return {
    ok: false,
    type: "project_memory_production_readiness_auto_verification_result",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_VERSION,
    decision: PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_DECISIONS.REJECTED,
    ready: false,
    reason,
    verified: false,
    autoTriggered: false,
    report: null,
    boundaries: getProjectMemoryProductionReadinessAutoVerifierBoundaries(),
    ...extra,
  };
}

export function getProjectMemoryProductionReadinessAutoVerifierBoundaries() {
  return {
    automaticRuntimePath: true,
    userShellCommandRequired: false,
    userTelegramCommandRequired: false,
    explicitTrustedEvidenceRequired: true,
    trustedEvidenceOnly: true,
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
    emitsRawLogs: false,
    emitsSecrets: false,
    canClaimReadinessWithoutVerifiedEvidence: false,
  };
}

export function buildProjectMemoryProductionReadinessAutoVerifierStatus() {
  return {
    ok: true,
    type: "project_memory_production_readiness_auto_verifier_status",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_VERSION,
    boundaries: getProjectMemoryProductionReadinessAutoVerifierBoundaries(),
  };
}

function normalizeDeployEvidence(evidence = {}) {
  const safeEvidence = normalizePlainObject(evidence);

  return {
    rollbackPoint: normalizeText(safeEvidence.rollbackPoint),
    deployDone: normalizeBoolean(safeEvidence.deployDone),
    renderLogsClean: normalizeBoolean(safeEvidence.renderLogsClean),
  };
}

function normalizeRuntimeEvidence(runtime = {}) {
  const safeRuntime = normalizePlainObject(runtime);

  return {
    candidateCreationTestedSafely: normalizeBoolean(safeRuntime.candidateCreationTestedSafely),
    confirmationTestedSafely: normalizeBoolean(safeRuntime.confirmationTestedSafely),
    confirmedReadTestedSafely: normalizeBoolean(safeRuntime.confirmedReadTestedSafely),
    restoreContextTested: normalizeBoolean(safeRuntime.restoreContextTested),
    featureFlagsVerifiedSafe: normalizeBoolean(safeRuntime.featureFlagsVerifiedSafe),
    countsVerified: normalizeBoolean(safeRuntime.countsVerified),
    candidateCount: Number.isInteger(safeRuntime.candidateCount) ? safeRuntime.candidateCount : 0,
    confirmedCount: Number.isInteger(safeRuntime.confirmedCount) ? safeRuntime.confirmedCount : 0,
    staleCount: Number.isInteger(safeRuntime.staleCount) ? safeRuntime.staleCount : 0,
    conflictCount: Number.isInteger(safeRuntime.conflictCount) ? safeRuntime.conflictCount : 0,
    restoreEntryCount: Number.isInteger(safeRuntime.restoreEntryCount) ? safeRuntime.restoreEntryCount : 0,
    restoreCharCount: Number.isInteger(safeRuntime.restoreCharCount) ? safeRuntime.restoreCharCount : 0,
    staleOrConflictLabelsPresent: normalizeBoolean(safeRuntime.staleOrConflictLabelsPresent),
    restoreSummary: normalizeText(safeRuntime.restoreSummary) || "auto_verifier_restore_summary_not_provided",
  };
}

function validateTrustedAutoEvidence({ trigger, evidence, runtime }) {
  const errors = [];
  const safeTrigger = normalizePlainObject(trigger);

  if (safeTrigger.source !== "sg_runtime") errors.push("trigger_source_not_sg_runtime");
  if (safeTrigger.eventType !== "deploy_evidence_verified") errors.push("trigger_event_type_not_deploy_evidence_verified");
  if (safeTrigger.trusted !== true) errors.push("trigger_not_trusted");
  if (safeTrigger.sanitized !== true) errors.push("trigger_not_sanitized");
  if (!normalizeText(evidence.rollbackPoint)) errors.push("rollback_point_missing");
  if (evidence.deployDone !== true) errors.push("deploy_evidence_missing_or_false");
  if (evidence.renderLogsClean !== true) errors.push("render_logs_clean_evidence_missing_or_false");
  if (runtime.candidateCreationTestedSafely !== true) errors.push("candidate_creation_safe_test_missing");
  if (runtime.confirmationTestedSafely !== true) errors.push("confirmation_safe_test_missing");
  if (runtime.confirmedReadTestedSafely !== true) errors.push("confirmed_read_safe_test_missing");
  if (runtime.restoreContextTested !== true) errors.push("restore_context_safe_test_missing");
  if (runtime.featureFlagsVerifiedSafe !== true) errors.push("feature_flags_safe_test_missing");
  if (runtime.countsVerified !== true) errors.push("counts_verification_missing");

  return {
    ok: errors.length === 0,
    errors,
  };
}

export async function runProjectMemoryProductionReadinessAutoVerifier({
  trigger = {},
  evidence = {},
  runtime = {},
  liveDbCheck = null,
  runtimeCheck = null,
} = {}) {
  const safeTrigger = normalizePlainObject(trigger);
  const safeEvidence = normalizeDeployEvidence(evidence);
  const safeRuntime = normalizeRuntimeEvidence(runtime);
  const validation = validateTrustedAutoEvidence({
    trigger: safeTrigger,
    evidence: safeEvidence,
    runtime: safeRuntime,
  });

  if (!validation.ok) {
    return buildRejected("trusted_auto_evidence_incomplete", {
      autoTriggered: true,
      errors: validation.errors,
    });
  }

  const result = await runProjectMemoryProductionReadinessDiagnostics({
    runtime: safeRuntime,
    evidence: safeEvidence,
    liveDbCheck,
    runtimeCheck,
  });

  return {
    ok: result.ready === true,
    type: "project_memory_production_readiness_auto_verification_result",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_VERSION,
    decision: result.ready === true
      ? PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_DECISIONS.VERIFIED_READY
      : PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_DECISIONS.NOT_READY,
    ready: result.ready === true,
    verified: result.ready === true,
    autoTriggered: true,
    summary: result.summary,
    report: result.report,
    sanitized: true,
    readOnly: true,
    boundaries: getProjectMemoryProductionReadinessAutoVerifierBoundaries(),
  };
}

export default {
  PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_VERSION,
  PROJECT_MEMORY_PRODUCTION_READINESS_AUTO_VERIFIER_DECISIONS,
  buildProjectMemoryProductionReadinessAutoVerifierStatus,
  getProjectMemoryProductionReadinessAutoVerifierBoundaries,
  runProjectMemoryProductionReadinessAutoVerifier,
};
