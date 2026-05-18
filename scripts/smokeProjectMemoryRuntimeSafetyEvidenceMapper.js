// scripts/smokeProjectMemoryRuntimeSafetyEvidenceMapper.js
// SG 2.0 smoke test for Project Memory runtime safety evidence mapper.
// Deterministic/offline. No GitHub/Render fetch, no DB writes, no Project Memory writes, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  buildProjectMemoryRuntimeSafetyEvidence,
  buildProjectMemoryRuntimeSafetyEvidenceMapperStatus,
  getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries,
} from "../src/diagnostics/projectMemoryRuntimeSafetyEvidenceMapper.js";

const boundaries = getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries();
assert.equal(boundaries.readOnly, true);
assert.equal(boundaries.providedEvidenceOnly, true);
assert.equal(boundaries.mapsSanitizedWorkflowRuns, true);
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

const status = buildProjectMemoryRuntimeSafetyEvidenceMapperStatus();
assert.equal(status.ok, true);
assert.equal(status.boundaries.readOnly, true);
assert.equal(status.boundaries.fetchesGitHub, false);

const workflowRuns = [
  { name: "SG2 Project Memory Manual Candidate Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Explicit Confirmation Flow Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Confirmed Read Flow Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Message Project Memory Context Gate Smoke", status: "completed", conclusion: "success" },
  { name: "SG2 Project Memory Runtime Diagnostics Smoke", status: "completed", conclusion: "success" },
];

const mapped = buildProjectMemoryRuntimeSafetyEvidence({
  workflowRuns,
  runtimeCheck: {
    ok: true,
    details: {
      projectMemoryReadEnabled: false,
      promptInjectionEnabled: false,
    },
  },
  counts: {
    candidateCount: 2,
    confirmedCount: 1,
    staleCount: 0,
    conflictCount: 0,
    restoreEntryCount: 1,
    restoreCharCount: 120,
    staleOrConflictLabelsPresent: true,
  },
});

assert.equal(mapped.ok, true);
assert.equal(mapped.runtime.candidateCreationTestedSafely, true);
assert.equal(mapped.runtime.confirmationTestedSafely, true);
assert.equal(mapped.runtime.confirmedReadTestedSafely, true);
assert.equal(mapped.runtime.restoreContextTested, true);
assert.equal(mapped.runtime.featureFlagsVerifiedSafe, true);
assert.equal(mapped.runtime.countsVerified, true);
assert.equal(mapped.runtime.candidateCount, 2);
assert.equal(mapped.runtime.confirmedCount, 1);
assert.equal(mapped.runtime.evidenceMapper.providedOnly, true);
assert.equal(mapped.runtime.evidenceMapper.fetchesGitHub, false);
assert.equal(mapped.runtime.evidenceMapper.fetchesRender, false);
assert.equal(mapped.warnings.length, 0);

const missing = buildProjectMemoryRuntimeSafetyEvidence({
  workflowRuns: [
    { name: "SG2 Project Memory Manual Candidate Smoke", status: "completed", conclusion: "success" },
  ],
  runtimeCheck: { ok: false, details: { promptInjectionEnabled: false } },
  counts: {},
});

assert.equal(missing.ok, false);
assert.equal(missing.runtime.candidateCreationTestedSafely, true);
assert.equal(missing.runtime.confirmationTestedSafely, false);
assert.equal(missing.runtime.confirmedReadTestedSafely, false);
assert.equal(missing.runtime.restoreContextTested, false);
assert.equal(missing.runtime.featureFlagsVerifiedSafe, false);
assert.equal(missing.runtime.countsVerified, false);
assert.equal(missing.warnings.some((warning) => warning.group === "confirmation"), true);
assert.equal(missing.warnings.some((warning) => warning.group === "confirmedRead"), true);
assert.equal(missing.warnings.some((warning) => warning.group === "restoreContext"), true);

console.log("smokeProjectMemoryRuntimeSafetyEvidenceMapper: ok");
