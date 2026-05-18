// scripts/smokeProjectMemoryProductionReadinessAutoVerifier.js
// SG 2.0 smoke test for automatic Project Memory production readiness verifier.
// Purpose: prove readiness verification is event-driven, read-only, fail-closed, and not a user/shell command path.

import assert from "node:assert/strict";

import {
  buildProjectMemoryProductionReadinessAutoVerifierStatus,
  getProjectMemoryProductionReadinessAutoVerifierBoundaries,
  runProjectMemoryProductionReadinessAutoVerifier,
} from "../src/diagnostics/projectMemoryProductionReadinessAutoVerifier.js";

const boundaries = getProjectMemoryProductionReadinessAutoVerifierBoundaries();
assert.equal(boundaries.automaticRuntimePath, true);
assert.equal(boundaries.userShellCommandRequired, false);
assert.equal(boundaries.userTelegramCommandRequired, false);
assert.equal(boundaries.explicitTrustedEvidenceRequired, true);
assert.equal(boundaries.trustedEvidenceOnly, true);
assert.equal(boundaries.readOnly, true);
assert.equal(boundaries.writesDatabase, false);
assert.equal(boundaries.writesProjectMemory, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.writesRepository, false);
assert.equal(boundaries.changesEnvironment, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.emitsRawLogs, false);
assert.equal(boundaries.emitsSecrets, false);
assert.equal(boundaries.canClaimReadinessWithoutVerifiedEvidence, false);

const status = buildProjectMemoryProductionReadinessAutoVerifierStatus();
assert.equal(status.ok, true);
assert.equal(status.boundaries.userShellCommandRequired, false);

const rejected = await runProjectMemoryProductionReadinessAutoVerifier({
  trigger: {
    source: "user_shell",
    eventType: "manual_check",
    trusted: false,
    sanitized: true,
  },
  evidence: {
    rollbackPoint: "173826a17182057f635444cb6701ac556cdcdf00",
    deployDone: true,
    renderLogsClean: true,
  },
  runtime: {},
});

assert.equal(rejected.ok, false);
assert.equal(rejected.ready, false);
assert.equal(rejected.decision, "project_memory_production_readiness_auto_verification_rejected");
assert.equal(rejected.reason, "trusted_auto_evidence_incomplete");
assert.equal(rejected.autoTriggered, true);
assert.equal(rejected.errors.includes("trigger_source_not_sg_runtime"), true);
assert.equal(rejected.errors.includes("trigger_event_type_not_deploy_evidence_verified"), true);
assert.equal(rejected.errors.includes("trigger_not_trusted"), true);

const incompleteTrusted = await runProjectMemoryProductionReadinessAutoVerifier({
  trigger: {
    source: "sg_runtime",
    eventType: "deploy_evidence_verified",
    trusted: true,
    sanitized: true,
  },
  evidence: {
    rollbackPoint: "173826a17182057f635444cb6701ac556cdcdf00",
    deployDone: true,
    renderLogsClean: true,
  },
  runtime: {
    candidateCreationTestedSafely: true,
  },
});

assert.equal(incompleteTrusted.ok, false);
assert.equal(incompleteTrusted.ready, false);
assert.equal(incompleteTrusted.errors.includes("confirmation_safe_test_missing"), true);
assert.equal(incompleteTrusted.errors.includes("confirmed_read_safe_test_missing"), true);
assert.equal(incompleteTrusted.errors.includes("restore_context_safe_test_missing"), true);

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

const verifiedRuntimeCheck = {
  ok: true,
  summary: "Project Memory runtime boundaries OK.",
  details: {
    projectMemoryReadEnabled: false,
    promptInjectionEnabled: false,
  },
  sanitized: true,
};

const ready = await runProjectMemoryProductionReadinessAutoVerifier({
  trigger: {
    source: "sg_runtime",
    eventType: "deploy_evidence_verified",
    trusted: true,
    sanitized: true,
  },
  evidence: {
    rollbackPoint: "173826a17182057f635444cb6701ac556cdcdf00",
    deployDone: true,
    renderLogsClean: true,
  },
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
    restoreEntryCount: 1,
    restoreCharCount: 120,
    staleOrConflictLabelsPresent: true,
    restoreSummary: "Restore context verified safely.",
  },
  liveDbCheck: verifiedLiveDbCheck,
  runtimeCheck: verifiedRuntimeCheck,
});

assert.equal(ready.ok, true);
assert.equal(ready.ready, true);
assert.equal(ready.verified, true);
assert.equal(ready.autoTriggered, true);
assert.equal(ready.decision, "project_memory_production_readiness_verified_ready");
assert.equal(ready.boundaries.userShellCommandRequired, false);
assert.equal(ready.boundaries.userTelegramCommandRequired, false);
assert.equal(JSON.stringify(ready).includes("DATABASE_URL"), false);
assert.equal(JSON.stringify(ready).includes("postgres://"), false);

console.log("OK: Project Memory production readiness auto verifier is event-driven, read-only, and fail-closed");
