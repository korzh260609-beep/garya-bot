// scripts/smokeProjectMemoryProductionReadinessDiagnosticsRunner.js
// SG 2.0 smoke test for Project Memory production readiness diagnostics runner.
// Purpose: prove the runner remains read-only, fails closed without full evidence, and can report ready only when injected verified evidence is complete.

import assert from "node:assert/strict";

import {
  getProjectMemoryProductionReadinessDiagnosticsRunnerStatus,
  runProjectMemoryProductionReadinessDiagnostics,
} from "../src/diagnostics/projectMemoryProductionReadinessDiagnosticsRunner.js";

const status = getProjectMemoryProductionReadinessDiagnosticsRunnerStatus();
assert.equal(status.ok, true);
assert.equal(status.readOnly, true);
assert.equal(status.writesDatabase, false);
assert.equal(status.writesProjectMemory, false);
assert.equal(status.writesRuntimeFiles, false);
assert.equal(status.writesRepository, false);
assert.equal(status.changesEnvironment, false);
assert.equal(status.touchesTelegram, false);
assert.equal(status.callsAI, false);
assert.equal(status.fetchesGitHub, false);
assert.equal(status.fetchesRender, false);
assert.equal(status.canClaimReadinessWithoutVerifiedEvidence, false);
assert.deepEqual(status.checks, [
  "project_memory_runtime",
  "project_memory_live_db",
  "project_memory_production_readiness",
]);

const verifiedRuntimeCheck = {
  ok: true,
  summary: "Project Memory runtime boundaries OK.",
  details: {
    projectMemoryReadEnabled: false,
    promptInjectionEnabled: false,
  },
  sanitized: true,
};

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

const incomplete = await runProjectMemoryProductionReadinessDiagnostics({
  runtimeCheck: verifiedRuntimeCheck,
  liveDbCheck: verifiedLiveDbCheck,
  evidence: {
    rollbackPoint: "dd3e359fcc26cd5b477ed3b1468f9e4959a8cb4e",
    deployDone: true,
    renderLogsClean: true,
  },
});

assert.equal(incomplete.ready, false);
assert.equal(incomplete.ok, false);
assert.equal(incomplete.report.results.length, 3);
assert.equal(incomplete.report.results[0].type, "project_memory_runtime");
assert.equal(incomplete.report.results[1].type, "project_memory_live_db");
assert.equal(incomplete.report.results[2].type, "project_memory_production_readiness");
assert.equal(incomplete.report.results[2].ok, false);
assert.equal(incomplete.sanitized, true);
assert.equal(incomplete.readOnly, true);

const ready = await runProjectMemoryProductionReadinessDiagnostics({
  runtimeCheck: verifiedRuntimeCheck,
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
    restoreEntryCount: 1,
    restoreCharCount: 120,
    staleOrConflictLabelsPresent: true,
    restoreSummary: "Restore context verified safely.",
  },
  evidence: {
    rollbackPoint: "dd3e359fcc26cd5b477ed3b1468f9e4959a8cb4e",
    deployDone: true,
    renderLogsClean: true,
  },
});

assert.equal(ready.ready, true);
assert.equal(ready.ok, true);
assert.equal(ready.report.ok, true);
assert.equal(ready.report.results.every((item) => item.ok), true);
assert.equal(ready.report.results[2].data.ready, true);
assert.equal(JSON.stringify(ready).includes("postgres://"), false);
assert.equal(JSON.stringify(ready).includes("DATABASE_URL="), false);

console.log("OK: Project Memory production readiness diagnostics runner is read-only and evidence-gated");
