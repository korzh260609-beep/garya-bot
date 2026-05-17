// src/diagnostics/projectMemoryProductionReadinessCheck.js
// SG 2.0 — Project Memory production readiness verification check.
// Purpose: aggregate read-only live DB metadata, safe runtime flags, rollback/deploy evidence, and diagnostics readiness.
// This module does not write DB, Project Memory, runtime files, repository state, env, Telegram, or AI outputs.

import { runProjectMemoryLiveDbCheck } from "./projectMemoryLiveDbCheck.js";
import {
  buildProjectMemoryDiagnostics,
} from "../memory/index.js";

export const PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION = 1;

const REQUIRED_CHECKS = Object.freeze([
  "database_configured",
  "db_connection_works",
  "project_memory_tables_exist",
  "project_memory_indexes_exist",
  "project_memory_constraints_exist",
  "candidate_creation_tested_safely",
  "confirmation_tested_safely",
  "confirmed_read_tested_safely",
  "restore_context_tested_safely",
  "feature_flags_verified_safe",
  "diagnostics_verified_safe",
  "rollback_path_exists",
]);

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

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createCheck({ key, ok, evidenceLevel, summary, required = true, details = {} }) {
  return {
    key,
    ok: Boolean(ok),
    required: Boolean(required),
    evidenceLevel: normalizeText(evidenceLevel) || "unknown",
    summary: normalizeText(summary) || "not_provided",
    details: normalizePlainObject(details),
  };
}

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildRollbackCheck(evidence = {}) {
  const rollbackPoint = normalizeText(evidence.rollbackPoint || evidence.rollback_point || evidence.currentHeadSha);
  const deployClean = normalizeBoolean(evidence.deployClean || evidence.renderLogsClean || evidence.logsClean);
  const deployDone = normalizeBoolean(evidence.deployDone || evidence.deployed);

  return {
    rollbackPoint,
    deployDone,
    deployClean,
    deployEvidenceProvided: deployDone === true && deployClean === true,
  };
}

function buildFeatureFlagsSnapshot(runtime = {}) {
  const featureFlags = normalizePlainObject(runtime.featureFlags || runtime.feature_flags);

  return {
    readEnabled: normalizeBoolean(featureFlags.readEnabled || featureFlags.read_enabled),
    writeEnabled: normalizeBoolean(featureFlags.writeEnabled || featureFlags.write_enabled),
    sourceSyncEnabled: normalizeBoolean(featureFlags.sourceSyncEnabled || featureFlags.source_sync_enabled),
    autoConfirmEnabled: normalizeBoolean(featureFlags.autoConfirmEnabled || featureFlags.auto_confirm_enabled),
    promptInjectionEnabled: normalizeBoolean(featureFlags.promptInjectionEnabled || featureFlags.prompt_injection_enabled),
  };
}

function buildGateSnapshot(runtime = {}) {
  const readGate = normalizePlainObject(runtime.readGate || runtime.read_gate);
  const writeGate = normalizePlainObject(runtime.writeGate || runtime.write_gate);

  return {
    readGate: {
      enabled: normalizeBoolean(readGate.enabled),
      confirmedOnly: normalizeBoolean(readGate.confirmedOnly || readGate.confirmed_only, true),
      bounded: normalizeBoolean(readGate.bounded),
      summary: normalizeText(readGate.summary) || "read_gate_status_not_provided",
    },
    writeGate: {
      enabled: normalizeBoolean(writeGate.enabled),
      candidateOnly: normalizeBoolean(writeGate.candidateOnly || writeGate.candidate_only, true),
      requiresConfirmation: normalizeBoolean(writeGate.requiresConfirmation || writeGate.requires_confirmation, true),
      summary: normalizeText(writeGate.summary) || "write_gate_status_not_provided",
    },
  };
}

function buildSafeRuntimeSnapshot({ liveDbCheck = {}, runtime = {}, evidence = {} } = {}) {
  const details = normalizePlainObject(liveDbCheck.details);
  const featureFlags = buildFeatureFlagsSnapshot(runtime);
  const gates = buildGateSnapshot(runtime);
  const rollback = buildRollbackCheck(evidence);

  const dbOk = liveDbCheck.ok === true && details.databaseConfigured === true && details.checked === true;
  const schemaOk = dbOk
    && normalizeArray(details.missingTables).length === 0
    && normalizeArray(details.missingIndexes).length === 0
    && normalizeArray(details.missingConstraints).length === 0;

  return {
    storage: {
      configured: details.databaseConfigured === true,
      reachable: dbOk,
      verified: dbOk,
      summary: liveDbCheck.summary || "project_memory_live_db_check_not_available",
    },
    schema: {
      expectedTablesKnown: true,
      tablesVerified: schemaOk,
      indexesVerified: schemaOk,
      constraintsVerified: schemaOk,
      summary: schemaOk ? "Project Memory schema metadata verified." : "Project Memory schema metadata not fully verified.",
    },
    counts: {
      candidateCount: Number.isInteger(runtime.candidateCount) ? runtime.candidateCount : 0,
      confirmedCount: Number.isInteger(runtime.confirmedCount) ? runtime.confirmedCount : 0,
      staleCount: Number.isInteger(runtime.staleCount) ? runtime.staleCount : 0,
      conflictCount: Number.isInteger(runtime.conflictCount) ? runtime.conflictCount : 0,
      verified: normalizeBoolean(runtime.countsVerified),
    },
    featureFlags,
    readGate: gates.readGate,
    writeGate: gates.writeGate,
    lastRestoreContext: {
      available: normalizeBoolean(runtime.restoreContextTested || runtime.restoreAvailable),
      entryCount: Number.isInteger(runtime.restoreEntryCount) ? runtime.restoreEntryCount : 0,
      charCount: Number.isInteger(runtime.restoreCharCount) ? runtime.restoreCharCount : 0,
      staleOrConflictLabelsPresent: normalizeBoolean(runtime.staleOrConflictLabelsPresent),
      summary: normalizeText(runtime.restoreSummary) || "restore_context_status_not_provided",
    },
    rollback,
  };
}

function buildChecks({ liveDbCheck = {}, diagnosticsResult = {}, runtime = {}, evidence = {} } = {}) {
  const details = normalizePlainObject(liveDbCheck.details);
  const runtimeSafe = normalizePlainObject(runtime);
  const rollback = buildRollbackCheck(evidence);
  const diagnostics = normalizePlainObject(diagnosticsResult.diagnostics);
  const productionReadiness = normalizePlainObject(diagnostics.productionReadiness);

  const dbConfigured = details.databaseConfigured === true;
  const dbChecked = details.checked === true;
  const liveDbOk = liveDbCheck.ok === true && dbConfigured && dbChecked;
  const tablesOk = liveDbOk && normalizeArray(details.missingTables).length === 0;
  const indexesOk = liveDbOk && normalizeArray(details.missingIndexes).length === 0;
  const constraintsOk = liveDbOk && normalizeArray(details.missingConstraints).length === 0;
  const featureFlagsSafe =
    runtimeSafe.featureFlagsVerifiedSafe === true ||
    (
      buildFeatureFlagsSnapshot(runtimeSafe).autoConfirmEnabled === false &&
      buildFeatureFlagsSnapshot(runtimeSafe).promptInjectionEnabled === false
    );
  const diagnosticsSafe = diagnosticsResult.ok === true && productionReadiness.claim !== "production_readiness_supported_by_provided_verified_snapshot"
    ? true
    : diagnosticsResult.ok === true;

  return [
    createCheck({
      key: "database_configured",
      ok: dbConfigured,
      evidenceLevel: "configured_runtime",
      summary: dbConfigured ? "DATABASE_URL configured without exposing secret value." : "DATABASE_URL is not configured.",
    }),
    createCheck({
      key: "db_connection_works",
      ok: liveDbOk,
      evidenceLevel: "verified_db_state",
      summary: liveDbOk ? "Live DB metadata queries completed." : "Live DB metadata queries did not complete successfully.",
    }),
    createCheck({
      key: "project_memory_tables_exist",
      ok: tablesOk,
      evidenceLevel: "verified_db_state",
      summary: tablesOk ? "Project Memory expected tables exist." : "Project Memory expected tables are not fully verified.",
      details: { missingTables: normalizeArray(details.missingTables) },
    }),
    createCheck({
      key: "project_memory_indexes_exist",
      ok: indexesOk,
      evidenceLevel: "verified_db_state",
      summary: indexesOk ? "Project Memory expected indexes exist." : "Project Memory expected indexes are not fully verified.",
      details: { missingIndexes: normalizeArray(details.missingIndexes) },
    }),
    createCheck({
      key: "project_memory_constraints_exist",
      ok: constraintsOk,
      evidenceLevel: "verified_db_state",
      summary: constraintsOk ? "Project Memory expected constraints exist." : "Project Memory expected constraints are not fully verified.",
      details: { missingConstraints: normalizeArray(details.missingConstraints) },
    }),
    createCheck({
      key: "candidate_creation_tested_safely",
      ok: normalizeBoolean(runtimeSafe.candidateCreationTestedSafely),
      evidenceLevel: "verified_runtime_behavior",
      summary: "Candidate creation safety must be proven by smoke/runtime evidence.",
    }),
    createCheck({
      key: "confirmation_tested_safely",
      ok: normalizeBoolean(runtimeSafe.confirmationTestedSafely),
      evidenceLevel: "verified_runtime_behavior",
      summary: "Confirmation safety must be proven by smoke/runtime evidence.",
    }),
    createCheck({
      key: "confirmed_read_tested_safely",
      ok: normalizeBoolean(runtimeSafe.confirmedReadTestedSafely),
      evidenceLevel: "verified_runtime_behavior",
      summary: "Confirmed read safety must be proven by smoke/runtime evidence.",
    }),
    createCheck({
      key: "restore_context_tested_safely",
      ok: normalizeBoolean(runtimeSafe.restoreContextTested),
      evidenceLevel: "verified_runtime_behavior",
      summary: "Restore context safety must be proven by smoke/runtime evidence.",
    }),
    createCheck({
      key: "feature_flags_verified_safe",
      ok: featureFlagsSafe,
      evidenceLevel: "configured_runtime",
      summary: featureFlagsSafe ? "Feature flags appear safe for Project Memory." : "Feature flags are not verified safe.",
    }),
    createCheck({
      key: "diagnostics_verified_safe",
      ok: diagnosticsSafe,
      evidenceLevel: "configured_runtime",
      summary: diagnosticsSafe ? "Project Memory diagnostics produced sanitized result." : "Project Memory diagnostics are not verified safe.",
    }),
    createCheck({
      key: "rollback_path_exists",
      ok: Boolean(rollback.rollbackPoint),
      evidenceLevel: "repo_runtime_evidence",
      summary: rollback.rollbackPoint ? "Rollback point provided." : "Rollback point missing.",
      details: { rollbackPoint: rollback.rollbackPoint },
    }),
  ];
}

function buildWarnings({ checks = [], liveDbCheck = {}, evidence = {} } = {}) {
  const warnings = [];
  const failedRequiredChecks = checks.filter((check) => check.required && !check.ok).map((check) => check.key);
  const deploy = buildRollbackCheck(evidence);

  if (failedRequiredChecks.length) {
    warnings.push(createWarning(
      "production_readiness_not_established",
      "Project Memory production readiness is not established because one or more required checks failed.",
      { failedRequiredChecks },
    ));
  }

  if (liveDbCheck.ok !== true) {
    warnings.push(createWarning(
      "live_db_not_verified",
      liveDbCheck.summary || "Project Memory live DB state is not verified.",
    ));
  }

  if (deploy.deployEvidenceProvided !== true) {
    warnings.push(createWarning(
      "deploy_evidence_not_provided",
      "Deploy evidence was not provided or does not prove deployDone=true and deployClean=true.",
      { deployDone: deploy.deployDone, deployClean: deploy.deployClean },
    ));
  }

  return warnings;
}

export function getProjectMemoryProductionReadinessCheckBoundaries() {
  return {
    readOnly: true,
    aggregatesExistingChecksOnly: true,
    canRunLiveDbMetadataCheck: true,
    canBuildDiagnosticsFromProvidedSnapshot: true,
    writesDatabase: false,
    writesProjectMemory: false,
    writesRuntimeFiles: false,
    writesRepository: false,
    changesEnvironment: false,
    touchesTelegram: false,
    callsAI: false,
    fetchesRender: false,
    fetchesGitHub: false,
    emitsSecrets: false,
    emitsRawDatabaseUrl: false,
    emitsRawLogs: false,
  };
}

export function buildProjectMemoryProductionReadinessCheckStatus() {
  return {
    ok: true,
    type: "project_memory_production_readiness_check_status",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION,
    requiredChecks: REQUIRED_CHECKS,
    canClaimProductionReadinessWithoutVerifiedEvidence: false,
    boundaries: getProjectMemoryProductionReadinessCheckBoundaries(),
  };
}

export async function runProjectMemoryProductionReadinessCheck({
  runtime = {},
  evidence = {},
  liveDbCheck = null,
} = {}) {
  const safeRuntime = normalizePlainObject(runtime);
  const safeEvidence = normalizePlainObject(evidence);
  const dbCheck = liveDbCheck || await runProjectMemoryLiveDbCheck();
  const snapshot = buildSafeRuntimeSnapshot({
    liveDbCheck: dbCheck,
    runtime: safeRuntime,
    evidence: safeEvidence,
  });
  const diagnosticsResult = buildProjectMemoryDiagnostics({ snapshot });
  const checks = buildChecks({
    liveDbCheck: dbCheck,
    diagnosticsResult,
    runtime: safeRuntime,
    evidence: safeEvidence,
  });
  const requiredChecksPassed = checks.filter((check) => check.required).every((check) => check.ok);
  const deploy = buildRollbackCheck(safeEvidence);
  const ready = requiredChecksPassed && deploy.deployEvidenceProvided === true;
  const warnings = buildWarnings({ checks, liveDbCheck: dbCheck, evidence: safeEvidence });

  return {
    ok: ready,
    type: "project_memory_production_readiness_check",
    version: PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION,
    summary: ready
      ? "Project Memory production readiness is verified by provided runtime/deploy evidence and live DB metadata."
      : "Project Memory production readiness is not established.",
    ready,
    requiredChecksPassed,
    deployEvidenceProvided: deploy.deployEvidenceProvided,
    checks,
    diagnostics: diagnosticsResult.diagnostics || null,
    liveDbCheck: {
      ok: Boolean(dbCheck.ok),
      summary: dbCheck.summary || "not_available",
      sanitized: dbCheck.sanitized === true,
      readOnly: dbCheck.readOnly === true,
      details: normalizePlainObject(dbCheck.details),
      warnings: normalizeArray(dbCheck.warnings),
    },
    rollbackPoint: deploy.rollbackPoint || null,
    warnings,
    errors: diagnosticsResult.ok ? [] : [
      createError("project_memory_diagnostics_failed", diagnosticsResult.reason || "Project Memory diagnostics failed."),
    ],
    sanitized: true,
    readOnly: true,
    boundaries: getProjectMemoryProductionReadinessCheckBoundaries(),
  };
}

export default {
  PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION,
  REQUIRED_CHECKS,
  buildProjectMemoryProductionReadinessCheckStatus,
  getProjectMemoryProductionReadinessCheckBoundaries,
  runProjectMemoryProductionReadinessCheck,
};
