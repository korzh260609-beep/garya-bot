// src/memory/project/projectMemoryTrustedConfirmationFlow.js
// SG 2.0 — Project Memory Trusted Confirmation Flow.
// Purpose: confirm durable pending Project Memory candidates only through explicit trusted allowlisted project evidence.
// This module does not create candidates, call AI, touch transport, fetch sources, inject prompts, source-sync, or modify repository/runtime state.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";
import { PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES } from "./projectMemoryAutomaticCandidatePipeline.js";

export const PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION = 1;

export const PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES = Object.freeze({
  EXPLICIT_TRUSTED_CONFIRM_ONLY: "explicit_trusted_confirm_only",
});

export const PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS = Object.freeze({
  CONFIRMED: "trusted_confirmation_confirmed",
  REQUEST_REJECTED: "trusted_confirmation_request_rejected",
});

const TRUSTED_EVENT_TYPES = Object.freeze([
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.ROLLBACK_POINT_CREATED,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.OBSERVATION_OK,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DIAGNOSTICS_OK,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.MONARCH_APPROVED_DECISION,
]);

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

function normalizeTrustedEvidence(evidence = {}) {
  const safeEvidence = normalizePlainObject(evidence);
  return {
    eventType: normalizeText(safeEvidence.eventType || safeEvidence.type),
    sourceRef: normalizeText(safeEvidence.sourceRef || safeEvidence.ref || safeEvidence.url),
    approvalRef: normalizeText(safeEvidence.approvalRef || safeEvidence.approval || safeEvidence.sourceRef),
    policy: normalizeText(safeEvidence.policy || "trusted_project_event_allowlist"),
    verified: safeEvidence.verified === true,
  };
}

function validateTrustedEvidence(evidence = {}) {
  const errors = [];

  if (!evidence.eventType) {
    errors.push(createError("missing_trusted_event_type", "Trusted confirmation requires evidence.eventType."));
  } else if (!TRUSTED_EVENT_TYPES.includes(evidence.eventType)) {
    errors.push(createError("unsupported_trusted_event_type", "Trusted confirmation event type is not allowlisted.", {
      eventType: evidence.eventType,
    }));
  }

  if (!evidence.sourceRef) {
    errors.push(createError("missing_trusted_source_ref", "Trusted confirmation requires evidence.sourceRef."));
  }

  if (!evidence.verified) {
    errors.push(createError("trusted_evidence_not_verified", "Trusted confirmation requires evidence.verified === true."));
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function getProjectMemoryTrustedConfirmationFlowBoundaries() {
  return {
    transportIndependent: true,
    explicitTrustedConfirmRequestOnly: true,
    trustedEventsOnly: true,
    allowlistedEvidenceOnly: true,
    createsCandidates: false,
    confirmsPendingCandidatesWhenExplicitTrustedEvidence: true,
    writesConfirmedMemoryThroughConfirmationBoundaryOnly: true,
    callsAI: false,
    fetchesSources: false,
    sourceSync: false,
    autoConfirmsFromChat: false,
    autoWritesFromChat: false,
    autoWritesFromAI: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryTrustedConfirmationFlowStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryTrustedConfirmationFlow",
    version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
    canConfirmPendingCandidate: true,
    canCreateCandidate: false,
    requiresExplicitTrustedConfirmRequest: true,
    requiresVerifiedTrustedEvidence: true,
    supportedEventTypes: TRUSTED_EVENT_TYPES,
    boundaries: getProjectMemoryTrustedConfirmationFlowBoundaries(),
  };
}

export async function confirmTrustedProjectMemoryCandidate({
  request = {},
  actor = {},
  confirmation = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryTrustedConfirmationFlowBoundaries();

  if (safeRequest.explicitTrustedConfirmRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_trusted_confirm_request",
      confirmed: false,
      errors: [
        createError(
          "missing_explicit_trusted_confirm_request",
          "Trusted Project Memory confirmation requires request.explicitTrustedConfirmRequest === true.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const entryId = normalizeText(safeRequest.entryId);
  if (!entryId) {
    return {
      ok: false,
      version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.REQUEST_REJECTED,
      reason: "missing_entry_id",
      confirmed: false,
      errors: [createError("missing_entry_id", "Trusted Project Memory confirmation requires entryId.")],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const evidence = normalizeTrustedEvidence(safeRequest.evidence);
  const evidenceValidation = validateTrustedEvidence(evidence);
  if (!evidenceValidation.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.REQUEST_REJECTED,
      reason: "trusted_evidence_rejected",
      confirmed: false,
      evidence,
      errors: evidenceValidation.errors,
      warnings: [],
      actor: safeActor,
      entryId,
      boundaries,
    };
  }

  const confirmationFlow = normalizeConfirmation(confirmation);
  const traceId = normalizeText(safeRequest.traceId) || null;
  const confirmedBy = normalizeText(safeRequest.confirmedBy) || buildActorRef(safeActor);
  const approvalRef = normalizeText(safeRequest.approvalRef) || evidence.approvalRef || evidence.sourceRef;

  const confirmed = await confirmationFlow.confirmCandidate({
    entryId,
    confirmedBy,
    traceId,
    approvalRef,
  });

  if (!confirmed.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.REQUEST_REJECTED,
      reason: confirmed.reason || "trusted_candidate_confirm_failed",
      confirmed: false,
      evidence,
      confirmation: confirmed,
      errors: confirmed.errors || [],
      warnings: confirmed.warnings || [],
      actor: safeActor,
      entryId,
      boundaries,
    };
  }

  return {
    ok: true,
    version: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY,
    decision: PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.CONFIRMED,
    confirmed: true,
    evidence,
    entry: confirmed.entry,
    trust: confirmed.trust,
    traceId: confirmed.traceId || traceId,
    approvalRef: confirmed.approvalRef || approvalRef,
    actor: safeActor,
    entryId,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_VERSION,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS,
  buildProjectMemoryTrustedConfirmationFlowStatus,
  getProjectMemoryTrustedConfirmationFlowBoundaries,
  confirmTrustedProjectMemoryCandidate,
};
