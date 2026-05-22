// src/memory/project/projectMemoryAutomaticDurableCandidateFlow.js
// SG 2.0 — Project Memory Automatic Durable Candidate Flow.
// Purpose: convert trusted, allowlisted project events into durable pending Project Memory candidates.
// This module does not confirm candidates, write confirmed memory, call AI, touch transport, fetch sources, inject prompts, or modify repository/runtime state.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";
import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
  prepareProjectMemoryCandidateFromEvent,
} from "./projectMemoryAutomaticCandidatePipeline.js";

export const PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION = 1;

export const PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES = Object.freeze({
  EXPLICIT_TRUSTED_EVENT_ONLY: "explicit_trusted_event_only",
});

export const PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS = Object.freeze({
  DURABLE_CANDIDATE_CREATED: "automatic_durable_candidate_created",
  DUPLICATE_TRACE_ENTRY_REUSED: "automatic_durable_duplicate_trace_entry_reused",
  REQUEST_REJECTED: "automatic_durable_candidate_request_rejected",
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeActor(actor = {}) {
  return {
    globalUserId: normalizeText(actor?.globalUserId),
    platform: actor?.platform || "unknown",
    platformUserId: actor?.platformUserId || null,
    role: actor?.role || "system",
    isMonarch: Boolean(actor?.isMonarch),
  };
}

function buildActorRef(actor = {}) {
  const safeActor = normalizeActor(actor);
  if (safeActor.globalUserId) return safeActor.globalUserId;
  if (safeActor.platformUserId) return `${safeActor.platform}:${safeActor.platformUserId}`;
  return safeActor.role || "system";
}

function normalizeConfirmation(confirmation) {
  return confirmation || new ProjectMemoryConfirmation();
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

export function getProjectMemoryAutomaticDurableCandidateFlowBoundaries() {
  return {
    transportIndependent: true,
    explicitDurableCandidateRequestOnly: true,
    trustedEventsOnly: true,
    usesAutomaticCandidatePipeline: true,
    usesProjectMemoryConfirmationBoundary: true,
    createsDurablePendingCandidate: true,
    duplicateTraceGuard: true,
    duplicateTraceReusesExistingEntry: true,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    callsAI: false,
    fetchesSources: false,
    sourceSync: false,
    autoWritesFromChat: false,
    autoWritesFromAI: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryAutomaticDurableCandidateFlowStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryAutomaticDurableCandidateFlow",
    version: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
    canCreateDurablePendingCandidate: true,
    canReuseExistingEntryByTraceId: true,
    canConfirmCandidate: false,
    writesConfirmedMemory: false,
    requiresExplicitDurableCandidateRequest: true,
    requiresSeparateConfirmationFlow: true,
    boundaries: getProjectMemoryAutomaticDurableCandidateFlowBoundaries(),
  };
}

export async function createDurableProjectMemoryCandidateFromEvent({
  request = {},
  actor = {},
  confirmation = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryAutomaticDurableCandidateFlowBoundaries();

  if (safeRequest.explicitDurableCandidateRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_durable_candidate_request",
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      errors: [
        createError(
          "missing_explicit_durable_candidate_request",
          "Automatic durable Project Memory candidate creation requires request.explicitDurableCandidateRequest === true.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const event = normalizePlainObject(safeRequest.event);
  const prepared = prepareProjectMemoryCandidateFromEvent({ event });

  if (!prepared.ok || !prepared.candidatePrepared) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.REQUEST_REJECTED,
      reason: prepared.reason || "automatic_candidate_prepare_failed",
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      preparation: prepared,
      errors: prepared.errors || [],
      warnings: prepared.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  const confirmationFlow = normalizeConfirmation(confirmation);
  const createdBy = normalizeText(safeRequest.createdBy) || buildActorRef(safeActor);
  const traceId = normalizeText(safeRequest.traceId) || null;
  const projectKey = prepared.event?.projectKey || event.projectKey || "sg";
  const input = {
    ...prepared.candidate,
    metadata: {
      ...(prepared.candidate?.metadata || {}),
      automaticDurableCandidateFlowVersion: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
      automaticCandidatePipelineVersion: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
      durableWriteAttempted: true,
      durableWriteFlow: "ProjectMemoryAutomaticDurableCandidateFlow.createDurableProjectMemoryCandidateFromEvent",
      confirmationAttempted: false,
    },
  };

  const stored = await confirmationFlow.prepareCandidateForConfirmation({
    input,
    createdBy,
    projectKey,
    ...(traceId ? { traceId } : {}),
    actor: safeActor,
  });

  if (!stored.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.REQUEST_REJECTED,
      reason: stored.reason || "durable_candidate_storage_failed",
      candidatePrepared: true,
      stored: false,
      confirmed: false,
      preparation: prepared,
      storage: stored,
      errors: stored.errors || [],
      warnings: stored.warnings || [],
      actor: safeActor,
      projectKey,
      boundaries,
    };
  }

  const duplicateGuard = stored.duplicateGuard || null;
  const duplicateConfirmed = duplicateGuard?.matched === true
    && stored.entry?.trust === "confirmed"
    && stored.entry?.status === "active";

  return {
    ok: true,
    version: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
    decision: duplicateGuard?.matched
      ? PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.DUPLICATE_TRACE_ENTRY_REUSED
      : PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.DURABLE_CANDIDATE_CREATED,
    candidatePrepared: true,
    stored: true,
    confirmed: duplicateConfirmed,
    requiresConfirmation: !duplicateConfirmed,
    preparation: prepared,
    candidate: stored.candidate,
    entry: stored.entry,
    traceId: stored.traceId || traceId,
    duplicateGuard,
    actor: safeActor,
    projectKey,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_VERSION,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS,
  buildProjectMemoryAutomaticDurableCandidateFlowStatus,
  getProjectMemoryAutomaticDurableCandidateFlowBoundaries,
  createDurableProjectMemoryCandidateFromEvent,
};
