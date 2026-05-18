// scripts/smokeProjectMemoryProductionReadinessLiveEvidenceInvocation.js
// SG 2.0 smoke test for Project Memory production readiness live evidence invocation bridge.
// Deterministic/offline: injected DB/runtime check snapshots only.
// No real Render/GitHub fetching, no DB writes, no Project Memory writes, no Telegram, no AI, no raw logs/secrets.

import assert from "node:assert/strict";

import {
  buildProjectMemoryProductionReadinessLiveEvidenceInvocationStatus,
  getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries,
  runProjectMemoryProductionReadinessLiveEvidenceInvocation,
} from "../src/diagnostics/projectMemoryProductionReadinessLiveEvidenceInvocation.js";

function assertNoUnsafeDebugValues(value) {
  const text = JSON.stringify(value);
  assert.equal(text.includes("UNSAFE_DEBUG_RENDER_LOG_SHOULD_NOT_APPEAR"), false);
  assert.equal(text.includes("UNSAFE_DEBUG_PRIVATE_VALUE_SHOULD_NOT_APPEAR"), false);
}

const boundaries = getProjectMemoryProductionReadinessLiveEvidenceInvocationBoundaries();
assert.equal(boundaries.runtimeInvocationBridge, true);
assert.equal(boundaries.explicitRuntimeInvocationRequestOnly, true);
assert.equal(boundaries.acceptsTrustedSanitizedEvidenceOnly, true);
assert.equal(boundaries.acceptsSanitizedWorkflowRuntimeFacts, true);
assert.equal(boundaries.mapsRuntimeSafetyEvidence, true);
assert.equal(boundaries.invokesAutoVerifier, true);
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

const status = buildProjectMemoryProductionReadinessLiveEvidenceInvocationStatus();
assert.equal(status.ok, true);
assert.equal(status.canInvokeAutoVerifier, true);
assert.equal(status.boundaries.fetchesRender, false);

const missingExplicit = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {},
  actor: { role: "system", source: "sg_runtime" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
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
  },
});

assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.invoked, false);
assert.equal(missingExplicit.ready, false);
assert.equal(missingExplicit.errors.some((error) => error.code === "missing_explicit_project_memory_production_readiness_live_evidence_invocation_request"), true);
assertNoUnsafeDebugValues(missingExplicit);

const wrongActor = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {
    explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest: true,
  },
  actor: { role: "monarch", source: "telegram" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
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
  },
});

assert.equal(wrongActor.ok, false);
assert.equal(wrongActor.invoked, false);
assert.equal(wrongActor.errors.some((error) => error.code === "actor_role_not_system"), true);
assert.equal(wrongActor.errors.some((error) => error.code === "actor_source_not_sg_runtime"), true);
assertNoUnsafeDebugValues(wrongActor);

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

const ready = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {
    explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest: true,
  },
  actor: { role: "system", source: "sg_runtime" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
    deployDone: true,
    renderLogsClean: true,
    rawDebugLog: "UNSAFE_DEBUG_RENDER_LOG_SHOULD_NOT_APPEAR",
    privateDebugValue: "UNSAFE_DEBUG_PRIVATE_VALUE_SHOULD_NOT_APPEAR",
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
assert.equal(ready.invoked, true);
assert.equal(ready.ready, true);
assert.equal(ready.verified, true);
assert.equal(ready.runtimeSafetyEvidenceMapped, false);
assert.equal(ready.autoVerifierResult.ready, true);
assert.equal(ready.autoVerifierResult.autoTriggered, true);
assert.equal(ready.autoVerifierResult.boundaries.fetchesRender, false);
assert.equal(ready.boundaries.fetchesGitHub, false);
assert.equal(ready.boundaries.fetchesRender, false);
assertNoUnsafeDebugValues(ready);

const sanitizedWorkflowRuns = [
  { name: "SG2 Project Memory Manual Candidate Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Explicit Confirmation Flow Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Confirmed Read Flow Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Message Project Memory Context Gate Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Runtime Diagnostics Smoke", status: "completed", conclusion: "success" },
];

const mappedReady = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {
    explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest: true,
  },
  actor: { role: "system", source: "sg_runtime" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
    deployDone: true,
    renderLogsClean: true,
    rawDebugLog: "UNSAFE_DEBUG_RENDER_LOG_SHOULD_NOT_APPEAR",
    privateDebugValue: "UNSAFE_DEBUG_PRIVATE_VALUE_SHOULD_NOT_APPEAR",
  },
  workflowRuns: sanitizedWorkflowRuns,
  counts: {
    candidateCount: 2,
    confirmedCount: 1,
    staleCount: 0,
    conflictCount: 0,
    restoreEntryCount: 1,
    restoreCharCount: 120,
    staleOrConflictLabelsPresent: true,
  },
  liveDbCheck: verifiedLiveDbCheck,
  runtimeCheck: verifiedRuntimeCheck,
});

assert.equal(mappedReady.ok, true);
assert.equal(mappedReady.invoked, true);
assert.equal(mappedReady.ready, true);
assert.equal(mappedReady.verified, true);
assert.equal(mappedReady.runtimeSafetyEvidenceMapped, true);
assert.equal(mappedReady.runtimeSafetyEvidenceMapperResult.ok, true);
assert.equal(mappedReady.runtimeSafetyEvidenceMapperResult.runtime.evidenceMapper.fetchesGitHub, false);
assert.equal(mappedReady.runtimeSafetyEvidenceMapperResult.runtime.evidenceMapper.fetchesRender, false);
assert.equal(mappedReady.autoVerifierResult.ready, true);
assertNoUnsafeDebugValues(mappedReady);

const mappedMissingEvidence = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {
    explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest: true,
  },
  actor: { role: "system", source: "sg_runtime" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
    deployDone: true,
    renderLogsClean: true,
  },
  workflowRuns: [
    { name: "SG2 Project Memory Manual Candidate Smoke", status: "completed", conclusion: "success" },
  ],
  counts: {},
  liveDbCheck: verifiedLiveDbCheck,
  runtimeCheck: verifiedRuntimeCheck,
});

assert.equal(mappedMissingEvidence.ok, false);
assert.equal(mappedMissingEvidence.invoked, false);
assert.equal(mappedMissingEvidence.ready, false);
assert.equal(mappedMissingEvidence.reason, "runtime_safety_evidence_mapping_failed");
assert.equal(mappedMissingEvidence.runtimeSafetyEvidenceMapped, true);
assert.equal(mappedMissingEvidence.runtimeSafetyEvidenceMapperResult.ok, false);
assert.equal(mappedMissingEvidence.errors.some((error) => error.group === "confirmation"), true);
assert.equal(mappedMissingEvidence.errors.some((error) => error.group === "confirmedRead"), true);
assert.equal(mappedMissingEvidence.errors.some((error) => error.group === "restoreContext"), true);
assertNoUnsafeDebugValues(mappedMissingEvidence);

const notReadyLiveDb = await runProjectMemoryProductionReadinessLiveEvidenceInvocation({
  request: {
    explicitProjectMemoryProductionReadinessLiveEvidenceInvocationRequest: true,
  },
  actor: { role: "system", source: "sg_runtime" },
  evidence: {
    rollbackPoint: "b43a3bdc4a3d650e4c255d14126bc224802accf3",
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
  },
  liveDbCheck: {
    ok: false,
    summary: "Project Memory live DB metadata needs attention.",
    sanitized: true,
    readOnly: true,
    details: {
      databaseConfigured: true,
      checked: true,
      missingTables: ["sg_project_memory_entries"],
      missingIndexes: [],
      missingConstraints: [],
    },
    warnings: [],
  },
  runtimeCheck: verifiedRuntimeCheck,
});

assert.equal(notReadyLiveDb.ok, false);
assert.equal(notReadyLiveDb.invoked, true);
assert.equal(notReadyLiveDb.ready, false);
assert.equal(notReadyLiveDb.verified, false);
assert.equal(notReadyLiveDb.autoVerifierResult.ready, false);
assertNoUnsafeDebugValues(notReadyLiveDb);

console.log("smokeProjectMemoryProductionReadinessLiveEvidenceInvocation: ok");
