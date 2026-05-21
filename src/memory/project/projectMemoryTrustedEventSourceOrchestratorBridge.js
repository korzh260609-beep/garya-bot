// src/memory/project/projectMemoryTrustedEventSourceOrchestratorBridge.js
// SG 2.0 — Project Memory Trusted Event Source -> Automatic Orchestrator bridge.
// Purpose: connect normalized trusted project events to durable candidate creation and policy-gated trusted auto-confirmation.
// This module does not call AI, touch Telegram, read raw chat, source-sync,
// fetch providers, write runtime files, or modify repository state.

import {
  evaluateProjectMemoryAutoConfirmation,
} from "./projectMemoryAutoConfirmationPolicy.js";
import { ProjectMemoryConfirmation } from "./projectMemoryConfirmation.js";
import {
  processProjectMemoryAutomaticEvent,
} from "./projectMemoryAutomaticOrchestrator.js";

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_VERSION = 3;

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES = Object.freeze({
  POLICY_GATED_AUTO_CONFIRM: "policy_gated_auto_confirm",
});

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS = Object.freeze({
  DISPATCHED_TO_ORCHESTRATOR: "trusted_event_source_dispatched_to_orchestrator",
  REQUEST_REJECTED: "trusted_event_source_orchestrator_request_rejected",
});

const AUTO_CONFIRM_POLICIES = Object.freeze({
  PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY: "project_memory_auto_confirmation_policy",
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

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeTrustedEvidence(evidence = {}, event = {}) {
  const safeEvidence = normalizePlainObject(evidence);
  const safeEvent = normalizePlainObject(event);

  return {
    eventType: normalizeText(safeEvidence.eventType || safeEvidence.type || safeEvent.eventType || safeEvent.type),
    sourceRef: normalizeText(safeEvidence.sourceRef || safeEvidence.ref || safeEvidence.url || safeEvent.sourceRef),
    approvalRef: normalizeText(safeEvidence.approvalRef || safeEvidence.approval || safeEvidence.sourceRef || safeEvent.sourceRef),
    policy: normalizeText(safeEvidence.policy || AUTO_CONFIRM_POLICIES.PROJECT_MEMORY_AUTO_CONFIRMATION_POLICY),
    verified: safeEvidence.verified === true,
  };
}

function getTrustedEvidence({ sourceResult = {}, suggestedRequest = {}, event = {} } = {}) {
  const safeSourceResult = normalizePlainObject(sourceResult);
  const safeSuggestedRequest = normalizePlainObject(suggestedRequest);
  const safeEvent = normalizePlainObject(event);
  const eventMetadata = normalizePlainObject(safeEvent.metadata);

  return normalizeTrustedEvidence(
    safeSuggestedRequest.evidence || safeSourceResult.evidence || eventMetadata.trustedEvidence,
    safeEvent,
  );
}

function buildAutoConfirmPolicyContext({ sourceResult = {}, suggestedRequest = {}, event = {} } = {}) {
  const safeSourceResult = normalizePlainObject(sourceResult);
  const safeSuggestedRequest = normalizePlainObject(suggestedRequest);
  const safeEvent = normalizePlainObject(event);
  const metadata = normalizePlainObject(safeEvent.metadata);
  const evidence = normalizePlainObject(safeSuggestedRequest.evidence || safeSourceResult.evidence);

  return {
    repositoryFullName: normalizeText(
      evidence.repositoryFullName ||
      evidence.repoFullName ||
      evidence.repository ||
      metadata.repositoryFullName ||
      metadata.repoFullName ||
      metadata.repository,
    ),
    baseBranch: normalizeText(
      evidence.baseBranch ||
      evidence.baseRef ||
      evidence.base ||
      metadata.baseBranch ||
      metadata.baseRef ||
      metadata.base,
    ),
    headSha: normalizeText(
      evidence.headSha ||
      evidence.mergeCommitSha ||
      evidence.sha ||
      metadata.headSha ||
      metadata.mergeCommitSha ||
      metadata.sha,
    ),
    sourceRef: normalizeText(evidence.sourceRef || safeEvent.sourceRef),
  };
}

function buildAutoConfirmDecision({ sourceResult = {}, suggestedRequest = {}, event = {}, actor = {} } = {}) {
  const safeSourceResult = normalizePlainObject(sourceResult);
  const safeSuggestedRequest = normalizePlainObject(suggestedRequest);
  const safeEvent = normalizePlainObject(event);
  const evidence = getTrustedEvidence({
    sourceResult: safeSourceResult,
    suggestedRequest: safeSuggestedRequest,
    event: safeEvent,
  });
  const warnings = [];
  const requestedAutoConfirm =
    safeSuggestedRequest.autoConfirm === true ||
    safeSourceResult.autoConfirm === true ||
    safeSourceResult.autoConfirmEligible === true;

  if (!requestedAutoConfirm) {
    return {
      autoConfirm: false,
      evidence,
      reason: "auto_confirm_not_requested_by_trusted_source",
      autoConfirmationPolicyResult: null,
      warnings,
    };
  }

  const policyResult = evaluateProjectMemoryAutoConfirmation({
    sourceKind: safeSourceResult.sourceKind,
    event: safeEvent,
    evidence,
    actor,
    context: buildAutoConfirmPolicyContext({
      sourceResult: safeSourceResult,
      suggestedRequest: safeSuggestedRequest,
      event: safeEvent,
    }),
  });

  if (!policyResult.allowed) {
    warnings.push(
      createWarning("auto_confirm_blocked_by_project_memory_policy", "Project Memory auto-confirmation policy denied this trusted source request.", {
        reason: policyResult.reason,
        sourceKind: policyResult.sourceKind,
      }),
    );

    return {
      autoConfirm: false,
      evidence,
      reason: policyResult.reason || "auto_confirmation_policy_denied",
      autoConfirmationPolicyResult: policyResult,
      warnings,
    };
  }

  return {
    autoConfirm: true,
    evidence,
    reason: policyResult.reason || "auto_confirmation_policy_passed",
    autoConfirmationPolicyResult: policyResult,
    warnings,
  };
}

export function getProjectMemoryTrustedEventSourceOrchestratorBridgeBoundaries() {
  return {
    transportIndependent: true,
    trustedEventSourceOutputOnly: true,
    callsAutomaticOrchestrator: true,
    forcedAutoConfirmFalse: false,
    policyGatedAutoConfirm: true,
    usesProjectMemoryAutoConfirmationPolicy: true,
    autoConfirmRequiresTrustedSourceRequest: true,
    autoConfirmRequiresPolicyAllow: true,
    createsDurablePendingCandidate: true,
    confirmsCandidatesWhenPolicyAllows: true,
    writesConfirmedMemoryThroughTrustedConfirmationOnly: true,
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
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.POLICY_GATED_AUTO_CONFIRM,
    canDispatchTrustedEventSourceOutputToOrchestrator: true,
    canCreateDurablePendingCandidate: true,
    canAutoConfirm: true,
    autoConfirmPolicyGated: true,
    supportedAutoConfirmPolicies: Object.values(AUTO_CONFIRM_POLICIES),
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
      mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.POLICY_GATED_AUTO_CONFIRM,
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
  const autoConfirmDecision = buildAutoConfirmDecision({
    sourceResult,
    suggestedRequest,
    event,
    actor: safeActor,
  });

  const request = {
    ...suggestedRequest,
    explicitAutomaticMemoryRequest: true,
    autoConfirm: autoConfirmDecision.autoConfirm,
    evidence: autoConfirmDecision.evidence,
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
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_MODES.POLICY_GATED_AUTO_CONFIRM,
    decision: orchestrator?.ok
      ? PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS.DISPATCHED_TO_ORCHESTRATOR
      : PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_ORCHESTRATOR_BRIDGE_DECISIONS.REQUEST_REJECTED,
    reason: orchestrator?.ok ? null : orchestrator?.reason || "automatic_orchestrator_failed",
    dispatched: true,
    candidatePrepared: Boolean(orchestrator?.candidatePrepared),
    stored: Boolean(orchestrator?.stored),
    confirmed: Boolean(orchestrator?.confirmed),
    requiresConfirmation: !orchestrator?.confirmed,
    autoConfirm: autoConfirmDecision.autoConfirm,
    autoConfirmReason: autoConfirmDecision.reason,
    autoConfirmationPolicyResult: autoConfirmDecision.autoConfirmationPolicyResult,
    trustedEvidence: autoConfirmDecision.evidence,
    trustedEventSourceResult: sourceResult,
    orchestrator,
    entry: orchestrator?.entry || null,
    traceId: orchestrator?.traceId || safeTraceId || null,
    actor: safeActor,
    warnings: [
      ...(sourceResult.warnings || []),
      ...autoConfirmDecision.warnings,
      ...(orchestrator?.warnings || []),
    ],
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
