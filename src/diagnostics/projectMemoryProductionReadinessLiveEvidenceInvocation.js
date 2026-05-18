// src/diagnostics/projectMemoryProductionReadinessLiveEvidenceInvocation.js
// SG 2.0 — Project Memory production readiness live evidence invocation bridge.
// Purpose: invoke the automatic Project Memory production readiness verifier from sanitized trusted runtime evidence.
// This bridge does not fetch GitHub/Render, does not write DB/Project Memory/runtime files/repo/env,
// does not touch Telegram, does not call AI, and does not expose raw logs/secrets.

import {
  runProjectMemoryProductionReadinessAutoVerifier,
} from "./projectMemoryProductionReadinessAutoVerifier.js";

export const PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_VERSION = 1;

export const PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_DECISIONS = Object.freeze({
  INVOKED: "project_memory_production_readiness_live_evidence_invoked",
  REJECTED: "project_memory_production_readiness_live_evidence_rejected",
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

function normalizeInteger(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function normalizeActor(actor = {}) {
  const safeActor = normalizePlainObject(actor);

  return {
    role: normalizeText(safeActor.role) || "system",
    isMonarch: normalizeBoolean(safeActor.isMonarch),
    source: normalizeText(safeActor.source) || "sg_runtime",
  };
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildRejected(reason, extra = {}) {
  return {
    ok: false,
    type: "project_memory_production_readiness_live_evidence_invocation_result",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_VERSION,
    decision: PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_DECISIONS.REJECTED,
    reason,
    invoked: false,
    ready: false,
    verified: false,
    autoVerifierResult: null,
    errors: [],
    warnings: [],
    sanitized: true,
    readOnly: true,
    boundaries: getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries(),
    ...extra,
  };
}

export function getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries() {
  return {
    runtimeInvocationBridge: true,
    explicitRuntimeInvocationRequestOnly: true,
    acceptsTrustedSanitizedEvidenceOnly: true,
    invokesAutoVerifier: true,
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

export function buildProjectMemoryProductionReadinessLiveEvidenceInvocationStatus() {
  return {
    ok: true,
    type: "project_memory_production_readiness_live_evidence_invocation_status",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_VERSION,
    canInvokeAutoVerifier: true,
    boundaries: getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries(),
  };
}

function normalizeDeployEvidence(evidence = {}) {
  const safeEvidence = normalizePlainObject(evidence);

  return {
    rollbackPoint: normalizeText(safeEvidence.rollbackPoint || safeEvidence.currentHeadSha),
    deployDone: normalizeBoolean(safeEvidence.deployDone || safeEvidence.deployed),
    renderLogsClean: normalizeBoolean(safeEvidence.renderLogsClean || safeEvidence.logsClean),
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
    candidateCount: normalizeInteger(safeRuntime.candidateCount),
    confirmedCount: normalizeInteger(safeRuntime.confirmedCount),
    staleCount: normalizeInteger(safeRuntime.staleCount),
    conflictCount: normalizeInteger(safeRuntime.conflictCount),
    restoreEntryCount: normalizeInteger(safeRuntime.restoreEntryCount),
    restoreCharCount: normalizeInteger(safeRuntime.restoreCharCount),
    staleOrConflictLabelsPresent: normalizeBoolean(safeRuntime.staleOrConflictLabelsPresent),
    restoreSummary: normalizeText(safeRuntime.restoreSummary) || "live_evidence_invocation_restore_summary_not_provided",
  };
}

function validateInvocationRequest({ request, actor, evidence, runtime }) {
  const errors = [];

  if (request.explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest !== true) {
    errors.push("missing_explicit_project_memory_production_readiness_live_evidence_invocation_request");
  }

  if (actor.role !== "system") errors.push("actor_role_not_system");
  if (actor.source !== "sg_runtime") errors.push("actor_source_not_sg_runtime");
  if (!evidence.rollbackPoint) errors.push("rollback_point_missing");
  if (evidence.deployDone !== true) errors.push("deploy_done_missing_or_false");
  if (evidence.renderLogsClean !== true) errors.push("render_logs_clean_missing_or_false");
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

export async function runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request = {},
  actor = {},
  evidence = {},
  runtime = {},
  liveDbCheck = null,
  runtimeCheck = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const safeEvidence = normalizeDeployEvidence(evidence);
  const safeRuntime = normalizeRuntimeEvidence(runtime);
  const validation = validateInvocationRequest({
    request: safeRequest,
    actor: safeActor,
    evidence: safeEvidence,
    runtime: safeRuntime,
  });

  if (!validation.ok) {
    return buildRejected("trusted_live_evidence_invocation_rejected", {
      errors: validation.errors.map((code) => createError(code, "Project Memory production readiness live evidence invocation rejected.", { code })),
      actor: safeActor,
    });
  }

  const autoVerifierResult = await runProjectMemoryProductionReadinessAutoVerifier({
    trigger: {
      source: "sg_runtime",
      eventType: "deploy_evidence_verified",
      trusted: true,
      sanitized: true,
    },
    evidence: safeEvidence,
    runtime: safeRuntime,
    liveDbCheck,
    runtimeCheck,
  });

  return {
    ok: autoVerifierResult.ready === true,
    type: "project_memory_production_readiness_live_evidence_invocation_result",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_VERSION,
    decision: PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_DECISIONS.INVOKED,
    invoked: true,
    ready: autoVerifierResult.ready === true,
    verified: autoVerifierResult.verified === true,
    autoVerifierResult,
    actor: safeActor,
    sanitized: true,
    readOnly: true,
    boundaries: getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries(),
  };
}

export default {
  PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_VERSION,
  PROJECT_MEMORY_PRODUCTION_READINESS_LIVE_EVIDENCE_INVOCATION_DECISIONS,
  buildProjectMemoryProductionReadinessLiveEvidenceInvocationStatus,
  getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries,
  runProjectMemoryProductionReadinessLiveEvidenceInvocation,
};
