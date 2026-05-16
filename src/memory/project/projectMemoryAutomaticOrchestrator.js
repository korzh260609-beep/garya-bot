// src/memory/project/projectMemoryAutomaticOrchestrator.js
// SG 2.0 — Project Memory Automatic Orchestrator.
// Purpose: orchestrate trusted project event -> durable pending candidate -> optional trusted confirmation.
// This module does not call AI, touch transport, fetch sources, inject prompts, source-sync, or modify repository/runtime state.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";
import {
  createDurableProjectMemoryCandidateFromEvent,
} from "./projectMemoryAutomaticDurableCandidateFlow.js";
import {
  confirmTrustedProjectMemoryCandidate,
} from "./projectMemoryTrustedConfirmationFlow.js";

export const PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION = 1;

export const PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES = Object.freeze({
  EXPLICIT_TRUSTED_EVENT_ONLY: "explicit_trusted_event_only",
});

export const PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS = Object.freeze({
  CANDIDATE_CREATED: "automatic_memory_candidate_created",
  CONFIRMED: "automatic_memory_confirmed",
  REQUEST_REJECTED: "automatic_memory_request_rejected",
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

function normalizeConfirmation(confirmation) {
  return confirmation || new ProjectMemoryConfirmation();
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildTrustedEvidenceFromEvent(event = {}, evidence = {}) {
  const safeEvent = normalizePlainObject(event);
  const safeEvidence = normalizePlainObject(evidence);

  return {
    eventType: normalizeText(safeEvidence.eventType || safeEvent.eventType || safeEvent.type),
    sourceRef: normalizeText(safeEvidence.sourceRef || safeEvent.sourceRef || safeEvent.ref || safeEvent.url),
    approvalRef: normalizeText(safeEvidence.approvalRef || safeEvidence.sourceRef || safeEvent.sourceRef),
    verified: safeEvidence.verified === true,
    policy: normalizeText(safeEvidence.policy || "trusted_project_event_allowlist"),
  };
}

export function getProjectMemoryAutomaticOrchestratorBoundaries() {
  return {
    transportIndependent: true,
    explicitAutomaticMemoryRequestOnly: true,
    trustedEventsOnly: true,
    canCreateDurablePendingCandidate: true,
    canConfirmWhenAutoConfirmTrueAndEvidenceVerified: true,
    confirmationRequiresTrustedEvidence: true,
    usesDurableCandidateFlow: true,
    usesTrustedConfirmationFlow: true,
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

export function buildProjectMemoryAutomaticOrchestratorStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryAutomaticOrchestrator",
    version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
    canCreateDurablePendingCandidate: true,
    canConfirmWithTrustedEvidence: true,
    requiresExplicitAutomaticMemoryRequest: true,
    requiresVerifiedTrustedEvidenceForConfirmation: true,
    boundaries: getProjectMemoryAutomaticOrchestratorBoundaries(),
  };
}

export async function processProjectMemoryAutomaticEvent({
  request = {},
  actor = {},
  confirmation = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryAutomaticOrchestratorBoundaries();

  if (safeRequest.explicitAutomaticMemoryRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_automatic_memory_request",
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      errors: [
        createError(
          "missing_explicit_automatic_memory_request",
          "Project Memory automatic orchestrator requires request.explicitAutomaticMemoryRequest === true.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const event = normalizePlainObject(safeRequest.event);
  const confirmationFlow = normalizeConfirmation(confirmation);
  const traceId = normalizeText(safeRequest.traceId) || null;
  const autoConfirm = safeRequest.autoConfirm === true;

  const durable = await createDurableProjectMemoryCandidateFromEvent({
    request: {
      explicitDurableCandidateRequest: true,
      event,
      ...(traceId ? { traceId } : {}),
      ...(safeRequest.createdBy ? { createdBy: safeRequest.createdBy } : {}),
    },
    actor: safeActor,
    confirmation: confirmationFlow,
  });

  if (!durable.ok || !durable.stored) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.REQUEST_REJECTED,
      reason: durable.reason || "durable_candidate_failed",
      candidatePrepared: Boolean(durable.candidatePrepared),
      stored: false,
      confirmed: false,
      durable,
      errors: durable.errors || [],
      warnings: durable.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  if (!autoConfirm) {
    return {
      ok: true,
      version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.CANDIDATE_CREATED,
      candidatePrepared: true,
      stored: true,
      confirmed: false,
      requiresConfirmation: true,
      durable,
      entry: durable.entry,
      traceId: durable.traceId || traceId,
      actor: safeActor,
      boundaries,
    };
  }

  const entryId = normalizeText(durable.entry?.id);
  const evidence = buildTrustedEvidenceFromEvent(event, safeRequest.evidence);
  const trusted = await confirmTrustedProjectMemoryCandidate({
    request: {
      explicitTrustedConfirmRequest: true,
      entryId,
      evidence,
      ...(traceId ? { traceId } : {}),
      ...(safeRequest.confirmedBy ? { confirmedBy: safeRequest.confirmedBy } : {}),
      ...(evidence.approvalRef ? { approvalRef: evidence.approvalRef } : {}),
    },
    actor: safeActor,
    confirmation: confirmationFlow,
  });

  if (!trusted.ok || !trusted.confirmed) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.REQUEST_REJECTED,
      reason: trusted.reason || "trusted_confirmation_failed",
      candidatePrepared: true,
      stored: true,
      confirmed: false,
      durable,
      trusted,
      entry: durable.entry,
      errors: trusted.errors || [],
      warnings: trusted.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  return {
    ok: true,
    version: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY,
    decision: PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.CONFIRMED,
    candidatePrepared: true,
    stored: true,
    confirmed: true,
    durable,
    trusted,
    entry: trusted.entry,
    traceId: trusted.traceId || durable.traceId || traceId,
    approvalRef: trusted.approvalRef || evidence.approvalRef || evidence.sourceRef,
    actor: safeActor,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_VERSION,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS,
  buildProjectMemoryAutomaticOrchestratorStatus,
  getProjectMemoryAutomaticOrchestratorBoundaries,
  processProjectMemoryAutomaticEvent,
};
