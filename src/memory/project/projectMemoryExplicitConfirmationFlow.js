// src/memory/project/projectMemoryExplicitConfirmationFlow.js
// SG 2.0 — Explicit Project Memory Confirmation Flow.
// Purpose: explicit approval request -> confirm pending Project Memory candidate.
// This module has no transport logic, no AI calls, no candidate creation, and no prompt injection.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";

export const PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION = 1;

export const PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES = Object.freeze({
  EXPLICIT_CONFIRM_ONLY: "explicit_confirm_only",
});

export const PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS = Object.freeze({
  CONFIRMED: "confirmed",
  REQUEST_REJECTED: "explicit_confirmation_request_rejected",
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

export function getProjectMemoryExplicitConfirmationFlowBoundaries() {
  return {
    transportIndependent: true,
    explicitConfirmRequestOnly: true,
    createsCandidates: false,
    confirmsPendingCandidatesWhenExplicitlyCalled: true,
    infersFromNaturalLanguage: false,
    callsAI: false,
    injectsPromptContext: false,
    fetchesSources: false,
    autoConfirmsFromChat: false,
    autoWritesFromChat: false,
  };
}

export function buildProjectMemoryExplicitConfirmationFlowStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryExplicitConfirmationFlow",
    version: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
    mode: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY,
    canConfirmPendingCandidate: true,
    canCreateCandidate: false,
    autoConfirmFromChat: false,
    autoWriteFromChat: false,
    autoWriteFromAI: false,
    promptInjection: false,
    callsAI: false,
    transportConnected: false,
    requiresExplicitConfirmRequest: true,
    boundaries: getProjectMemoryExplicitConfirmationFlowBoundaries(),
  };
}

export async function confirmExplicitProjectMemoryCandidate({
  request = {},
  actor = {},
  confirmation = null,
} = {}) {
  const safeRequest = normalizeInput(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryExplicitConfirmationFlowBoundaries();

  if (safeRequest.explicitConfirmRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_confirm_request",
      confirmed: false,
      promptInjectionEnabled: false,
      errors: [
        createError(
          "missing_explicit_confirm_request",
          "Project Memory candidate confirmation requires request.explicitConfirmRequest === true.",
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
      version: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: "missing_entry_id",
      confirmed: false,
      promptInjectionEnabled: false,
      errors: [
        createError("missing_entry_id", "Project Memory candidate entryId is required for confirmation."),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const traceId = normalizeText(safeRequest.traceId) || null;
  const approvalRef = normalizeText(safeRequest.approvalRef) || null;
  const confirmedBy = normalizeText(safeRequest.confirmedBy) || buildActorRef(safeActor);
  const confirmationFlow = normalizeConfirmation(confirmation);

  const confirmed = await confirmationFlow.confirmCandidate({
    entryId,
    confirmedBy,
    traceId,
    approvalRef,
  });

  if (!confirmed.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
      mode: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY,
      decision: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: confirmed.reason || "candidate_confirm_failed",
      confirmed: false,
      promptInjectionEnabled: false,
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
    version: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
    mode: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY,
    decision: PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.CONFIRMED,
    confirmed: true,
    promptInjectionEnabled: false,
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
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_VERSION,
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES,
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS,
  buildProjectMemoryExplicitConfirmationFlowStatus,
  getProjectMemoryExplicitConfirmationFlowBoundaries,
  confirmExplicitProjectMemoryCandidate,
};
