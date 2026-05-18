// src/diagnostics/projectMemoryRuntimeSafetyEvidenceMapper.js
// SG 2.0 — Project Memory runtime safety evidence mapper.
// Purpose: derive Project Memory runtime readiness evidence from provided sanitized workflow/runtime facts.
// This mapper does not fetch GitHub/Render, does not write DB/Project Memory/runtime files/repo/env,
// does not touch Telegram, does not call AI, and does not expose raw logs/secrets.

export const PROJECT_MEMORY_RUNTIME_SAFETY_EVIDENCE_MAPPER_VERSION = 1;

const REQUIRED_SMOKE_NAMES = Object.freeze({
  candidateCreation: [
    "SG2 Project Memory Manual Candidate Smoke",
    "SG2 Project Memory Automatic Candidate Smoke",
    "SG2 Project Memory Automatic Durable Candidate Flow Smoke",
  ],
  confirmation: [
    "SG2 Project Memory Explicit Confirmation Flow Smoke",
    "SG2 Project Memory Trusted Confirmation Flow Smoke",
    "SG2 Project Memory Storage Confirmation Smoke",
  ],
  confirmedRead: [
    "SG2 Project Memory Confirmed Read Flow Smoke",
    "SG2 Project Memory Runtime Context Smoke",
  ],
  restoreContext: [
    "SG2 Message Project Memory Context Gate Smoke",
    "SG2 Message Project Memory Env Context Smoke",
    "SG2 Message Project Memory ProjectKey Runtime Selection Smoke",
  ],
  diagnostics: [
    "SG2 Project Memory Runtime Diagnostics Smoke",
    "SG2 Project Memory Live DB Check Smoke",
    "SG2 Project Memory Production Readiness Diagnostics Runner Smoke",
  ],
});

function normalizeText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeRun(run = {}) {
  const safeRun = normalizePlainObject(run);
  return {
    name: normalizeText(safeRun.name || safeRun.workflowName || safeRun.workflow_name),
    status: normalizeText(safeRun.status),
    conclusion: normalizeText(safeRun.conclusion),
  };
}

function normalizeRuns(value) {
  return Array.isArray(value) ? value.map(normalizeRun).filter((run) => run.name) : [];
}

function isSuccessfulRun(run = {}) {
  return run.status === "completed" && run.conclusion === "success";
}

function hasAnySuccessfulRun(runs = [], names = []) {
  const nameSet = new Set(names);
  return runs.some((run) => nameSet.has(run.name) && isSuccessfulRun(run));
}

function findMissingGroups(runs = []) {
  return Object.entries(REQUIRED_SMOKE_NAMES)
    .filter(([, names]) => !hasAnySuccessfulRun(runs, names))
    .map(([group]) => group);
}

function buildRuntimeEvidence({ workflowRuns = [], runtimeCheck = {}, counts = {} } = {}) {
  const runs = normalizeRuns(workflowRuns);
  const safeRuntimeCheck = normalizePlainObject(runtimeCheck);
  const safeCounts = normalizePlainObject(counts);
  const runtimeDetails = normalizePlainObject(safeRuntimeCheck.details);
  const missingGroups = findMissingGroups(runs);
  const diagnosticsOk = hasAnySuccessfulRun(runs, REQUIRED_SMOKE_NAMES.diagnostics);
  const runtimeBoundariesOk = safeRuntimeCheck.ok === true;
  const featureFlagsVerifiedSafe = diagnosticsOk
    && runtimeBoundariesOk
    && runtimeDetails.promptInjectionEnabled !== true;

  return {
    candidateCreationTestedSafely: hasAnySuccessfulRun(runs, REQUIRED_SMOKE_NAMES.candidateCreation),
    confirmationTestedSafely: hasAnySuccessfulRun(runs, REQUIRED_SMOKE_NAMES.confirmation),
    confirmedReadTestedSafely: hasAnySuccessfulRun(runs, REQUIRED_SMOKE_NAMES.confirmedRead),
    restoreContextTested: hasAnySuccessfulRun(runs, REQUIRED_SMOKE_NAMES.restoreContext),
    featureFlagsVerifiedSafe,
    countsVerified: Number.isInteger(safeCounts.candidateCount)
      && Number.isInteger(safeCounts.confirmedCount)
      && Number.isInteger(safeCounts.staleCount)
      && Number.isInteger(safeCounts.conflictCount),
    candidateCount: Number.isInteger(safeCounts.candidateCount) ? safeCounts.candidateCount : 0,
    confirmedCount: Number.isInteger(safeCounts.confirmedCount) ? safeCounts.confirmedCount : 0,
    staleCount: Number.isInteger(safeCounts.staleCount) ? safeCounts.staleCount : 0,
    conflictCount: Number.isInteger(safeCounts.conflictCount) ? safeCounts.conflictCount : 0,
    restoreEntryCount: Number.isInteger(safeCounts.restoreEntryCount) ? safeCounts.restoreEntryCount : 0,
    restoreCharCount: Number.isInteger(safeCounts.restoreCharCount) ? safeCounts.restoreCharCount : 0,
    staleOrConflictLabelsPresent: safeCounts.staleOrConflictLabelsPresent === true,
    restoreSummary: "Project Memory runtime safety evidence derived from sanitized workflow/runtime facts.",
    evidenceMapper: {
      version: PROJECT_MEMORY_RUNTIME_SAFETY_EVIDENCE_MAPPER_VERSION,
      workflowRunsChecked: runs.length,
      missingGroups,
      providedOnly: true,
      fetchesGitHub: false,
      fetchesRender: false,
      readOnly: true,
    },
  };
}

export function getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries() {
  return {
    readOnly: true,
    providedEvidenceOnly: true,
    mapsSanitizedWorkflowRuns: true,
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
  };
}

export function buildProjectMemoryRuntimeSafetyEvidenceMapperStatus() {
  return {
    ok: true,
    type: "project_memory_runtime_safety_evidence_mapper_status",
    version: PROJECT_MEMORY_RUNTIME_SAFETY_EVIDENCE_MAPPER_VERSION,
    requiredSmokeNames: REQUIRED_SMOKE_NAMES,
    boundaries: getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries(),
  };
}

export function buildProjectMemoryRuntimeSafetyEvidence(input = {}) {
  const runtime = buildRuntimeEvidence(input);
  const missingGroups = runtime.evidenceMapper.missingGroups;
  return {
    ok: missingGroups.length === 0 && runtime.featureFlagsVerifiedSafe && runtime.countsVerified,
    type: "project_memory_runtime_safety_evidence",
    version: PROJECT_MEMORY_RUNTIME_SAFETY_EVIDENCE_MAPPER_VERSION,
    runtime,
    warnings: missingGroups.map((group) => ({
      code: "project_memory_runtime_safety_evidence_group_missing",
      group,
      message: "No successful sanitized workflow run was provided for this Project Memory safety evidence group.",
    })),
    sanitized: true,
    readOnly: true,
    boundaries: getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries(),
  };
}

export default {
  PROJECT_MEMORY_RUNTIME_SAFETY_EVIDENCE_MAPPER_VERSION,
  buildProjectMemoryRuntimeSafetyEvidenceMapperStatus,
  getProjectMemoryRuntimeSafetyEvidenceMapperBoundaries,
  buildProjectMemoryRuntimeSafetyEvidence,
};
