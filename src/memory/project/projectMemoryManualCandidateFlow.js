// src/memory/project/projectMemoryManualCandidateFlow.js
// SG 2.0 — Manual Project Memory Candidate Flow.
// Purpose: explicit request -> pending Project Memory candidate.
// This module has no transport logic, no AI calls, no candidate confirmation, and no prompt injection.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";

export const PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION = 1;

export const PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES = Object.freeze({
  EXPLICIT_MANUAL_ONLY: "explicit_manual_only",
});

export const PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS = Object.freeze({
  CANDIDATE_CREATED: "candidate_created_for_confirmation",
  REQUEST_REJECTED: "manual_candidate_request_rejected",
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeActor(actor = {}) {
  return {
    globalUserId: normalizeText(actor?.globalUserId),
    platform: actor?.platform || "unknown",
    platformUserId: actor?.platformUserId || null,
    role: actor?.role || "guest",
    isMonarch: Boolean(actor?.isMonarch),
  };
}

function buildActorRef(actor = {}) {
  const safeActor = normalizeActor(actor);
  if (safeActor.globalUserId) return safeActor.globalUserId;
  if (safeActor.platformUserId) return `${safeActor.platform}:${safeActor.platformUserId}`;
  return safeActor.role || "system";
}

function normalizeInput(input = {}) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeConfirmation(confirmation) {
  return confirmation || new ProjectMemoryConfirmation();
}

function hasCandidateContent(input = {}) {
  return Boolean(normalizeText(input.title) && normalizeText(input.content));
}

export function getProjectMemoryManualCandidateFlowBoundaries() {
  return {
    transportIndependent: true,
    explicitManualRequestOnly: true,
    infersFromNaturalLanguage: false,
    callsAI: false,
    confirmsCandidates: false,
    injectsPromptContext: false,
    fetchesSources: false,
    autoWritesFromChat: false,
    writesConfirmedMemory: false,
    writesPendingCandidatesWhenExplicitlyCalled: true,
  };
}

export function buildProjectMemoryManualCandidateFlowStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryManualCandidateFlow",
    version: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
    mode: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY,
    canCreatePendingCandidate: true,
    canConfirmCandidate: false,
    autoWriteFromChat: false,
    autoWriteFromAI: false,
    promptInjection: false,
    callsAI: false,
    transportConnected: false,
    requiresExplicitManualRequest: true,
    requiresSeparateConfirmation: true,
    boundaries: getProjectMemoryManualCandidateFlowBoundaries(),
  };
}

export async function prepareManualProjectMemoryCandidate({
  request = {},
  actor = {},
  confirmation = null,
} = {}) {
  const safeRequest = normalizeInput(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryManualCandidateFlowBoundaries();

  if (safeRequest.explicitManualRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY,
      decision: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_manual_request",
      stored: false,
      confirmed: false,
      promptInjectionEnabled: false,
      errors: [
        createError(
          "missing_explicit_manual_request",
          "Manual Project Memory candidate creation requires request.explicitManualRequest === true.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const input = normalizeInput(safeRequest.input);
  if (!hasCandidateContent(input)) {
    return {
      ok: false,
      version: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY,
      decision: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: "missing_candidate_title_or_content",
      stored: false,
      confirmed: false,
      promptInjectionEnabled: false,
      errors: [
        createError(
          "missing_candidate_title_or_content",
          "Manual Project Memory candidate requires title and content.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const projectKey = normalizeText(safeRequest.projectKey) || "sg";
  const traceId = normalizeText(safeRequest.traceId) || null;
  const createdBy = normalizeText(safeRequest.createdBy) || buildActorRef(safeActor);
  const confirmationFlow = normalizeConfirmation(confirmation);

  const prepared = await confirmationFlow.prepareCandidateForConfirmation({
    input,
    createdBy,
    projectKey,
    traceId,
    actor: safeActor,
  });

  if (!prepared.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY,
      decision: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: prepared.reason || "candidate_prepare_failed",
      stored: false,
      confirmed: false,
      promptInjectionEnabled: false,
      preparation: prepared,
      errors: prepared.errors || [],
      warnings: prepared.warnings || [],
      actor: safeActor,
      projectKey,
      boundaries,
    };
  }

  return {
    ok: true,
    version: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
    mode: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY,
    decision: PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.CANDIDATE_CREATED,
    stored: true,
    confirmed: false,
    requiresConfirmation: true,
    promptInjectionEnabled: false,
    candidate: prepared.candidate,
    entry: prepared.entry,
    traceId: prepared.traceId || traceId,
    actor: safeActor,
    projectKey,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_VERSION,
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS,
  buildProjectMemoryManualCandidateFlowStatus,
  getProjectMemoryManualCandidateFlowBoundaries,
  prepareManualProjectMemoryCandidate,
};
