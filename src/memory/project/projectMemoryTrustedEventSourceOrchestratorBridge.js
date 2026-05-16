// src/memory/project/projectMemoryTrustedEventSourceOrchestratorBridge.js
// SG 2.0 — Project Memory Trusted Event Source -> Automatic Orchestrator bridge.
// Purpose: connect normalized trusted project events to durable pending candidate creation.
// This module does not auto-confirm candidates, call AI, touch Telegram, read raw chat, source-sync,
// fetch providers, write runtime files, or modify repository state.

import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";
import {
  processProjectMemoryAutomaticEvent,
} from "./projectMemoryAutomaticOrchestrator.js";

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION = 1;

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES = Object.freeze({
  PENDING_CANDIDATE_ONLY: "pending_candidate_only",
});

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS = Object.freeze({
  DISPATCHED_TO_ORCHESTRATOR: "trusted_event_source_dispatched_to_orchestrator",
  REQUEST_REJECTED: "trusted_event_source_orchestrator_request_rejected",
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

export function getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries() {
  return {
    transportIndependent: true,
    trustedEventSourceOutputOnly: true,
    callsAutomaticOrchestrator: true,
    forcedAutoConfirmFalse: true,
    createsDurablePendingCandidate: true,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    callsAI: false,
    readsRawChat: false,
    touchesTelegram: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesSources: false,
    sourceSync: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryTrustedEventSourceOrchestratorBridgeStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryTrustedEventSourceOrchestratorBridge",
    version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.PENDING_CANDIDATE_ONLY,
    canDispatchTrustedEventSourceOutputToOrchestrator: true,
    canCreateDurablePendingCandidate: true,
    canAutoConfirm: false,
    boundaries: getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries(),
  };
}

export async function processTrustedEventSourceOutputThroughOrchestrator({
  trustedEventSourceResult = {},
  actor = {},
  confirmation = null,
  createdBy = "system",
  traceId = null,
} = {}) {
  const sourceResult = normalizePlainObject(trustedEventSourceResult);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries();

  if (!sourceResult.ok || sourceResult.trustedEventCreated !== true || !sourceResult.event) {
    return {
      ok: false,
      version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION,
      mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.PENDING_CANDIDATE_ONLY,
      decision: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS.REQUEST_REJECTED,
      reason: sourceResult.reason || "trusted_event_source_result_not_accepted",
      dispatched: false,
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      errors: [
        createError(
          "trusted_event_source_result_not_accepted",
          "Trusted event source output must be ok and contain a trusted event before dispatching to Project Memory automatic orchestrator.",
        ),
      ],
      warnings: sourceResult.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  const suggestedRequest = normalizePlainObject(sourceResult.suggestedOrchestratorRequest);
  const event = normalizePlainObject(suggestedRequest.event || sourceResult.event);
  const safeTraceId = normalizeText(traceId || suggestedRequest.traceId);
  const safeCreatedBy = normalizeText(createdBy || suggestedRequest.createdBy) || "system";

  const request = {
    ...suggestedRequest,
    explicitAutomaticMemoryRequest: true,
    autoConfirm: false,
    event,
    createdBy: safeCreatedBy,
    ...(safeTraceId ? { traceId: safeTraceId } : {}),
  };

  const orchestrator = await processProjectMemoryAutomaticEvent({
    request,
    actor: safeActor,
    confirmation: normalizeConfirmation(confirmation),
  });

  return {
    ok: Boolean(orchestrator?.ok),
    version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.PENDING_CANDIDATE_ONLY,
    decision: orchestrator?.ok
      ? PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS.DISPATCHED_TO_ORCHESTRATOR
      : PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS.REQUEST_REJECTED,
    reason: orchestrator?.ok ? null : orchestrator?.reason || "automatic_orchestrator_failed",
    dispatched: true,
    candidatePrepared: Boolean(orchestrator?.candidatePrepared),
    stored: Boolean(orchestrator?.stored),
    confirmed: false,
    requiresConfirmation: true,
    trustedEventSourceResult: sourceResult,
    orchestrator,
    entry: orchestrator?.entry || null,
    traceId: orchestrator?.traceId || safeTraceId || null,
    actor: safeActor,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS,
  buildProjectMemoryTrustedEventSourceOrchestratorBridgeStatus,
  getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries,
  processTrustedEventSourceOutputThroughOrchestrator,
};
