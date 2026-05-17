// scripts/smokeProjectMemoryProductionReadinessCheck.js
// SG 2.0 — Project Memory production readiness verification smoke.
// Deterministic/offline for success path via injected liveDbCheck.
// No DB writes, no Project Memory writes, no Telegram, no AI, no raw logs/secrets.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION,
  buildProjectMemoryProductionReadinessCheckStatus,
  getProjectMemoryProductionReadinessCheckBoundaries,
  runProjectMemoryProductionReadinessCheck,
} from "../src/diagnostics/projectMemoryProductionReadinessCheck.js";

const boundaries = getProjectMemoryProductionReadinessCheckBoundaries();
assert.equal(boundaries.readOnly, true);
assert.equal(boundaries.aggregatesExistingChecksOnly, true);
assert.equal(boundaries.canRunLiveDbMetadataCheck, true);
assert.equal(boundaries.canBuildDiagnosticsFromProvidedSnapshot, true);
assert.equal(boundaries.writesDatabase, false);
assert.equal(boundaries.writesProjectMemory, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.writesRepository, false);
assert.equal(boundaries.changesEnvironment, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.emitsSecrets, false);
assert.equal(boundaries.emitsRawDatabaseUrl, false);
assert.equal(boundaries.emitsRawLogs, false);

const status = buildProjectMemoryProductionReadinessCheckStatus();
assert.equal(status.ok, true);
assert.equal(status.version, PROJECT_MEMORY_PRODUCTION_READINESS_CHECK_VERSION);
assert.equal(status.canClaimProductionReadinessWithoutVerifiedEvidence, false);
assert.equal(status.requiredChecks.includes("database_configured"), true);
assert.equal(status.requiredChecks.includes("rollback_path_exists"), true);

const missingEvidence = await runProjectMemoryProductionReadinessCheck({
  liveDbCheck: {
    ok: false,
    summary: "Project Memory live DB check skipped: DATABASE_URL is not configured.",
    sanitized: true,
    readOnly: true,
    details: {
      databaseConfigured: false,
      checked: false,
      expectedTables: ["sg_project_memory_entries", "sg_project_memory_write_audit"],
      expectedIndexes: [],
      expectedConstraints: [],
      foundTables: [],
      foundIndexes: [],
      foundConstraints: [],
      missingTables: ["sg_project_memory_entries", "sg_project_memory_write_audit"],
      missingIndexes: [],
      missingConstraints: [],
    },
    warnings: [{ code: "database_not_configured" }],
  },
  runtime: {},
  evidence: {},
});

assert.equal(missingEvidence.ok, false);
assert.equal(missingEvidence.ready, false);
assert.equal(missingEvidence.requiredChecksPassed, false);
assert.equal(missingEvidence.deployEvidenceProvided, false);
assert.equal(missingEvidence.sanitized, true);
assert.equal(missingEvidence.readOnly, true);
assert.equal(missingEvidence.checks.find((check) => check.key === "database_configured").ok, false);
assert.equal(missingEvidence.checks.find((check) => check.key === "rollback_path_exists").ok, false);
assert.equal(missingEvidence.warnings.some((warning) => warning.code === "production_readiness_not_established"), true);
assert.equal(missingEvidence.warnings.some((warning) => warning.code === "deploy_evidence_not_provided"), true);

const verifiedLiveDbCheck = {
  ok: true,
  summary: "Project Memory live DB metadata OK.",
  sanitized: true,
  readOnly: true,
  details: {
    databaseConfigured: true,
    checked: true,
    expectedTables: ["sg_project_memory_entries", "sg_project_memory_write_audit"],
    expectedIndexes: [
      "sg_project_memory_entries_project_status_idx",
      "sg_project_memory_entries_scope_idx",
      "sg_project_memory_entries_source_idx",
      "sg_project_memory_write_audit_entry_idx",
    ],
    expectedConstraints: [
      "sg_project_memory_entries_pkey",
      "sg_project_memory_entries_trust_check",
      "sg_project_memory_entries_status_check",
      "sg_project_memory_write_audit_pkey",
    ],
    foundTables: ["sg_project_memory_entries", "sg_project_memory_write_audit"],
    foundIndexes: [
      "sg_project_memory_entries_project_status_idx",
      "sg_project_memory_entries_scope_idx",
      "sg_project_memory_entries_source_idx",
      "sg_project_memory_write_audit_entry_idx",
    ],
    foundConstraints: [
      "sg_project_memory_entries_pkey",
      "sg_project_memory_entries_trust_check",
      "sg_project_memory_entries_status_check",
      "sg_project_memory_write_audit_pkey",
    ],
    missingTables: [],
    missingIndexes: [],
    missingConstraints: [],
  },
  warnings: [],
};

const ready = await runProjectMemoryProductionReadinessCheck({
  liveDbCheck: verifiedLiveDbCheck,
  runtime: {
    candidateCreationTestedSafely: true,
    confirmationTestedSafely: true,
    confirmedReadTestedSafely: true,
    restoreContextTested: true,
    featureFlagsVerifiedSafe: true,
    countsVerified: true,
    candidateCount: 2,
    confirmedCount: 1,
    staleCount: 0,
    conflictCount: 0,
    featureFlags: {
      readEnabled: false,
      writeEnabled: false,
      sourceSyncEnabled: false,
      autoConfirmEnabled: false,
      promptInjectionEnabled: false,
    },
    readGate: {
      enabled: false,
      confirmedOnly: true,
      bounded: true,
      summary: "Read gate bounded and disabled by default.",
    },
    writeGate: {
      enabled: false,
      candidateOnly: true,
      requiresConfirmation: true,
      summary: "Write gate requires confirmation.",
    },
    restoreEntryCount: 1,
    restoreCharCount: 120,
    staleOrConflictLabelsPresent: true,
    restoreSummary: "Restore context smoke passed.",
  },
  evidence: {
    rollbackPoint: "76bcf81b29c2696134c4984db51a7bc53c98545c",
    deployDone: true,
    renderLogsClean: true,
  },
});

assert.equal(ready.ok, true);
assert.equal(ready.ready, true);
assert.equal(ready.requiredChecksPassed, true);
assert.equal(ready.deployEvidenceProvided, true);
assert.equal(ready.rollbackPoint, "76bcf81b29c2696134c4984db51a7bc53c98545c");
assert.equal(ready.checks.every((check) => check.ok), true);
assert.equal(ready.liveDbCheck.ok, true);
assert.equal(ready.liveDbCheck.sanitized, true);
assert.equal(ready.liveDbCheck.readOnly, true);
assert.equal(ready.diagnostics.productionReadiness.ready, true);
assert.equal(ready.boundaries.writesDatabase, false);
assert.equal(ready.boundaries.writesProjectMemory, false);
assert.equal(ready.boundaries.callsAI, false);
assert.equal(ready.boundaries.touchesTelegram, false);
assert.equal(JSON.stringify(ready).includes("postgres://"), false);
assert.equal(JSON.stringify(ready).includes("DATABASE_URL="), false);

const unsafeText = await runProjectMemoryProductionReadinessCheck({
  liveDbCheck: verifiedLiveDbCheck,
  runtime: {
    candidateCreationTestedSafely: true,
    confirmationTestedSafely: true,
    confirmedReadTestedSafely: true,
    restoreContextTested: true,
    featureFlagsVerifiedSafe: true,
    countsVerified: true,
    featureFlags: {
      autoConfirmEnabled: false,
      promptInjectionEnabled: false,
    },
    readGate: {
      enabled: false,
      confirmedOnly: true,
      bounded: true,
      summary: "DATABASE_URL=postgres://secret must not leak",
    },
    writeGate: {
      enabled: false,
      candidateOnly: true,
      requiresConfirmation: true,
      summary: "raw logs must not leak",
    },
    restoreSummary: "provider id must not leak",
  },
  evidence: {
    rollbackPoint: "76bcf81b29c2696134c4984db51a7bc53c98545c",
    deployDone: true,
    logsClean: true,
  },
});

assert.equal(JSON.stringify(unsafeText).includes("postgres://secret"), false);
assert.equal(JSON.stringify(unsafeText).includes("DATABASE_URL=postgres"), false);
assert.equal(JSON.stringify(unsafeText).includes("provider id must not leak"), false);
assert.equal(unsafeText.diagnostics.configuredRuntime.readGateStatus.summary, "redacted");
assert.equal(unsafeText.diagnostics.configuredRuntime.writeGateStatus.summary, "redacted");
assert.equal(unsafeText.diagnostics.lastRestoreContextSummary.summary, "redacted");

console.log("smokeProjectMemoryProductionReadinessCheck: ok");
