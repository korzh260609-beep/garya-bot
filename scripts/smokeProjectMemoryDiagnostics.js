// scripts/smokeProjectMemoryDiagnostics.js
// SG 2.0 — Project Memory Diagnostics smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI, no live verification.

import assert from "node:assert/strict";

import {
  buildProjectMemoryDiagnostics,
  buildProjectMemoryDiagnosticsStatus,
  getProjectMemoryDiagnosticsBoundaries,
  PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS,
  PROJECT_MEMORY_DIAGNOSTIC_FAMILIES,
} from "../src/memory/index.js";

const status = buildProjectMemoryDiagnosticsStatus();
assert.equal(status.ok, true);
assert.equal(status.service, "ProjectMemoryDiagnostics");
assert.equal(status.canUseProvidedSnapshot, true);
assert.equal(status.canVerifyLiveDbState, false);
assert.equal(status.canClaimProductionReadinessWithoutVerifiedSnapshot, false);
assert.equal(status.canEmitSecrets, false);
assert.equal(status.canEmitRawLogs, false);
assert.equal(status.callsAI, false);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.STORAGE_STATUS), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.SCHEMA_STATUS), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.CANDIDATE_COUNT), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.CONFIRMED_COUNT), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.STALE_CONFLICT_COUNT), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.FEATURE_FLAGS), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.READ_GATE_STATUS), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.WRITE_GATE_STATUS), true);
assert.equal(status.families.includes(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.LAST_RESTORE_CONTEXT_SUMMARY), true);
assert.equal(status.evidenceLevels.includes(PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.AVAILABLE_CODE), true);
assert.equal(status.evidenceLevels.includes(PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME), true);
assert.equal(status.evidenceLevels.includes(PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE), true);
assert.equal(status.evidenceLevels.includes(PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.PRODUCTION_READINESS), true);

const boundaries = getProjectMemoryDiagnosticsBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.providedSnapshotOnly, true);
assert.equal(boundaries.distinguishesAvailableCodeConfiguredRuntimeVerifiedDbAndProductionReadiness, true);
assert.equal(boundaries.emitsSanitizedDiagnosticsOnly, true);
assert.equal(boundaries.emitsSecrets, false);
assert.equal(boundaries.emitsRawDatabaseUrl, false);
assert.equal(boundaries.emitsRawLogs, false);
assert.equal(boundaries.emitsRawProviderIds, false);
assert.equal(boundaries.emitsPrivateTransportIds, false);
assert.equal(boundaries.emitsUnredactedUserIdentifiers, false);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.createsCandidates, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesWeb, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.readsRawChat, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.changesEnvironment, false);

const invalid = buildProjectMemoryDiagnostics({ snapshot: "not-object" });
assert.equal(invalid.ok, false);
assert.equal(invalid.reason, "invalid_snapshot_input");
assert.equal(invalid.diagnostics, null);

const unverified = buildProjectMemoryDiagnostics({
  snapshot: {
    storage: {
      configured: true,
      reachable: false,
      verified: false,
      summary: "DATABASE_URL=postgres://secret must be redacted",
    },
    schema: {
      expectedTablesKnown: true,
      tablesVerified: false,
      indexesVerified: false,
      constraintsVerified: false,
      summary: "Schema code exists but DB state not verified.",
    },
    counts: {
      candidateCount: 3,
      confirmedCount: 4,
      staleCount: 1,
      conflictCount: 2,
      verified: false,
    },
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
      summary: "Read gate disabled by default.",
    },
    writeGate: {
      enabled: false,
      candidateOnly: true,
      requiresConfirmation: true,
      summary: "Write gate requires confirmation.",
    },
    lastRestoreContext: {
      available: true,
      entryCount: 2,
      charCount: 300,
      staleOrConflictLabelsPresent: true,
      summary: "Last restore context summary only.",
    },
  },
});

assert.equal(unverified.ok, true);
assert.equal(unverified.diagnostics.availableCode.projectMemoryDiagnosticsAvailable, true);
assert.equal(unverified.diagnostics.configuredRuntime.storageStatus.summary, "redacted");
assert.equal(unverified.diagnostics.configuredRuntime.storageStatus.configured, true);
assert.equal(unverified.diagnostics.configuredRuntime.storageStatus.reachable, false);
assert.equal(unverified.diagnostics.verifiedDbState.schemaStatus.tablesVerified, false);
assert.equal(unverified.diagnostics.verifiedDbState.candidateCount.value, 3);
assert.equal(unverified.diagnostics.verifiedDbState.confirmedCount.value, 4);
assert.equal(unverified.diagnostics.verifiedDbState.staleConflictCount.stale, 1);
assert.equal(unverified.diagnostics.verifiedDbState.staleConflictCount.conflicted, 2);
assert.equal(unverified.diagnostics.productionReadiness.ready, false);
assert.equal(unverified.diagnostics.productionReadiness.claim, "production_readiness_not_established");
assert.equal(unverified.warnings.some((warning) => warning.code === "snapshot_contains_forbidden_material"), true);

const verifiedReady = buildProjectMemoryDiagnostics({
  snapshot: {
    storage: {
      configured: true,
      reachable: true,
      verified: true,
      summary: "Storage verified by provided diagnostic snapshot.",
    },
    schema: {
      expectedTablesKnown: true,
      tablesVerified: true,
      indexesVerified: true,
      constraintsVerified: true,
      summary: "Schema verified by provided diagnostic snapshot.",
    },
    counts: {
      candidateCount: 1,
      confirmedCount: 2,
      staleCount: 0,
      conflictCount: 0,
      verified: true,
    },
    featureFlags: {
      readEnabled: true,
      writeEnabled: true,
      sourceSyncEnabled: false,
      autoConfirmEnabled: false,
      promptInjectionEnabled: false,
    },
    readGate: {
      enabled: true,
      confirmedOnly: true,
      bounded: true,
      summary: "Read gate confirmed-only and bounded.",
    },
    writeGate: {
      enabled: true,
      candidateOnly: true,
      requiresConfirmation: true,
      summary: "Write gate candidate-only and confirmation-required.",
    },
  },
});

assert.equal(verifiedReady.ok, true);
assert.equal(verifiedReady.diagnostics.configuredRuntime.storageStatus.verified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.schemaStatus.tablesVerified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.schemaStatus.indexesVerified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.schemaStatus.constraintsVerified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.candidateCount.verified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.confirmedCount.verified, true);
assert.equal(verifiedReady.diagnostics.verifiedDbState.staleConflictCount.verified, true);
assert.equal(verifiedReady.diagnostics.productionReadiness.ready, true);
assert.equal(
  verifiedReady.diagnostics.productionReadiness.claim,
  "production_readiness_supported_by_provided_verified_snapshot",
);

assert.equal(verifiedReady.boundaries.readsStorage, false);
assert.equal(verifiedReady.boundaries.writesStorage, false);
assert.equal(verifiedReady.boundaries.callsAI, false);
assert.equal(verifiedReady.boundaries.fetchesGitHub, false);
assert.equal(verifiedReady.boundaries.fetchesRender, false);
assert.equal(verifiedReady.boundaries.fetchesWeb, false);
assert.equal(verifiedReady.boundaries.fetchesSources, false);
assert.equal(verifiedReady.boundaries.touchesTelegram, false);
assert.equal(verifiedReady.boundaries.modifiesRepository, false);
assert.equal(verifiedReady.boundaries.writesRuntimeFiles, false);
assert.equal(verifiedReady.boundaries.changesEnvironment, false);
assert.equal(verifiedReady.boundaries.writesConfirmedMemory, false);

console.log("smokeProjectMemoryDiagnostics: ok");
