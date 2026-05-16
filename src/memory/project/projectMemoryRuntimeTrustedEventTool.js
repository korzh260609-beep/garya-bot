// src/memory/project/projectMemoryRuntimeTrustedEventTool.js
// SG 2.0 — Project Memory Runtime Trusted Event Tool.
// Purpose: provide an internal tool/handler entrypoint for already-trusted project events.
// Flow: trusted project event -> Trusted Event Source -> Orchestrator Bridge -> durable candidate -> policy-gated confirmation.
// This module does not call AI, touch Telegram, read raw chat,
// source-sync, fetch GitHub/Render/providers, write runtime files, mutate repository state, or change env.

import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  createTrustedProjectEventForPrMerged,
  createTrustedProjectEventForRenderDeployEvidence,
} from "./projectMemoryTrustedEventSource.js";
import {
  processTrustedEventSourceOutputThroughOrchestrator,
} from "./projectMemoryTrustedEventSourceOrchestratorBridge.js";

export const PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION = 2;

export const PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES = Object.freeze({
  POLICY_GATED_AUTO_CONFIRM: "policy_gated_auto_confirm",
});

export const PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS = Object.freeze({
  DISPATCHED: "runtime_trusted_event_tool_dispatched",
  REQUEST_REJECTED: "runtime_trusted_event_tool_request_rejected",
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

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createRejectedResult({ reason, errors = [], warnings = [], actor = {} } = {}) {
  return {
    ok: false,
    version: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
    mode: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES.POLICY_GATED_AUTO_CONFIRM,
    decision: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS.REQUEST_REJECTED,
    reason,
    dispatched: false,
    trustedEventCreated: false,
    candidatePrepared: false,
    stored: false,
    confirmed: false,
    requiresConfirmation: true,
    errors,
    warnings,
    actor: normalizeActor(actor),
    boundaries: getProjectMemoryRuntimeTrustedEventToolBoundaries(),
  };
}

export function getProjectMemoryRuntimeTrustedEventToolBoundaries() {
  return {
    transportIndependent: true,
    internalToolHandlerOnly: true,
    requiresExplicitRuntimeTrustedEventToolRequest: true,
    acceptsTrustedProjectEventInputOnly: true,
    supportsPrMergedTrustedEvent: true,
    supportsRenderDeployLogsTrustedEvent: true,
    callsTrustedEventSource: true,
    callsOrchestratorBridge: true,
    createsDurablePendingCandidate: true,
    forcedAutoConfirmFalse: false,
    policyGatedAutoConfirm: true,
    confirmsCandidatesWhenPolicyAllows: true,
    writesConfirmedMemoryThroughTrustedConfirmationOnly: true,
    callsAI: false,
    readsRawChat: false,
    touchesTelegram: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesSources: false,
    sourceSync: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
    changesEnvironment: false,
  };
}

export function buildProjectMemoryRuntimeTrustedEventToolStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryRuntimeTrustedEventTool",
    version: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
    mode: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES.POLICY_GATED_AUTO_CONFIRM,
    canHandlePrMergedTrustedEvent: true,
    canHandleRenderDeployLogsTrustedEvent: true,
    canCreateDurablePendingCandidate: true,
    canAutoConfirmWhenPolicyAllows: true,
    supportedSourceKinds: [
      PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
    ],
    boundaries: getProjectMemoryRuntimeTrustedEventToolBoundaries(),
  };
}

function buildTrustedEventSourceResult({ safeRequest, sourceKind }) {
  const common = {
    request: {
      explicitTrustedEventSourceRequest: true,
    },
    projectKey: normalizeText(safeRequest.projectKey) || "sg",
    moduleKey: normalizeText(safeRequest.moduleKey) || "project_memory",
    stageKey: normalizeText(safeRequest.stageKey) || "stage_07_memory",
    tags: Array.isArray(safeRequest.tags) ? safeRequest.tags : [],
    metadata: normalizePlainObject(safeRequest.metadata),
  };

  if (sourceKind === PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED) {
    return createTrustedProjectEventForPrMerged({
      ...common,
      pr: normalizePlainObject(safeRequest.pr),
    });
  }

  if (sourceKind === PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS) {
    return createTrustedProjectEventForRenderDeployEvidence({
      ...common,
      evidence: normalizePlainObject(safeRequest.evidence || safeRequest.renderEvidence),
    });
  }

  return null;
}

export async function runProjectMemoryRuntimeTrustedEventTool({
  request = {},
  actor = {},
  confirmation = null,
  createdBy = "runtime-trusted-event-tool",
  traceId = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryRuntimeTrustedEventToolBoundaries();

  if (safeRequest.explicitRuntimeTrustedEventToolRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_runtime_trusted_event_tool_request",
      actor: safeActor,
      errors: [
        createError(
          "missing_explicit_runtime_trusted_event_tool_request",
          "Project Memory runtime trusted event tool requires request.explicitRuntimeTrustedEventToolRequest === true.",
        ),
      ],
    });
  }

  const sourceKind = normalizeText(safeRequest.sourceKind)
    || PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED;

  if (![
    PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
    PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
  ].includes(sourceKind)) {
    return createRejectedResult({
      reason: "unsupported_runtime_trusted_event_source_kind",
      actor: safeActor,
      errors: [
        createError(
          "unsupported_runtime_trusted_event_source_kind",
          "Project Memory runtime trusted event tool supports only github_pr_merged and render_deploy_logs trusted events.",
          { sourceKind },
        ),
      ],
    });
  }

  const trustedEventSourceResult = buildTrustedEventSourceResult({ safeRequest, sourceKind });

  if (!trustedEventSourceResult?.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
      mode: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES.POLICY_GATED_AUTO_CONFIRM,
      decision: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS.REQUEST_REJECTED,
      reason: trustedEventSourceResult?.reason || "trusted_event_source_failed",
      dispatched: false,
      trustedEventCreated: false,
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      requiresConfirmation: true,
      trustedEventSourceResult,
      errors: trustedEventSourceResult?.errors || [],
      warnings: trustedEventSourceResult?.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  const bridgeResult = await processTrustedEventSourceOutputThroughOrchestrator({
    trustedEventSourceResult,
    actor: safeActor,
    confirmation,
    createdBy: normalizeText(createdBy) || "runtime-trusted-event-tool",
    traceId: normalizeText(traceId || safeRequest.traceId) || null,
  });

  return {
    ok: Boolean(bridgeResult?.ok),
    version: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
    mode: PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES.POLICY_GATED_AUTO_CONFIRM,
    decision: bridgeResult?.ok
      ? PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS.DISPATCHED
      : PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS.REQUEST_REJECTED,
    reason: bridgeResult?.ok ? null : bridgeResult?.reason || "orchestrator_bridge_failed",
    dispatched: Boolean(bridgeResult?.dispatched),
    trustedEventCreated: true,
    candidatePrepared: Boolean(bridgeResult?.candidatePrepared),
    stored: Boolean(bridgeResult?.stored),
    confirmed: Boolean(bridgeResult?.confirmed),
    requiresConfirmation: !bridgeResult?.confirmed,
    trustedEventSourceResult,
    bridge: bridgeResult,
    entry: bridgeResult?.entry || null,
    traceId: bridgeResult?.traceId || normalizeText(traceId || safeRequest.traceId) || null,
    actor: safeActor,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_VERSION,
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_MODES,
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT_TOOL_DECISIONS,
  buildProjectMemoryRuntimeTrustedEventToolStatus,
  getProjectMemoryRuntimeTrustedEventToolBoundaries,
  runProjectMemoryRuntimeTrustedEventTool,
};
