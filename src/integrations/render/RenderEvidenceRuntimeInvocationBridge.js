// src/integrations/render/RenderEvidenceRuntimeInvocationBridge.js
// SG 2.0 — Render Evidence Runtime Invocation Bridge v1.
// Purpose: connect sanitized Render deploy/log evidence collection to the Project Memory runtime trusted event tool.
// This module does not write runtime files, does not mutate repo/env, does not touch Telegram,
// does not call AI, does not expose raw logs/secrets, and does not put Render fetching inside Project Memory.

import { RenderEvidenceBridge } from "./RenderEvidenceBridge.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  runProjectMemoryRuntimeTrustedEventTool,
} from "../../memory/index.js";

export const RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION = 1;

export const RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES = Object.freeze({
  EXPLICIT_RUNTIME_INVOCATION_ONLY: "explicit_runtime_invocation_only",
});

export const RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS = Object.freeze({
  DISPATCHED: "render_evidence_runtime_invocation_dispatched",
  REQUEST_REJECTED: "render_evidence_runtime_invocation_rejected",
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
  const safeActor = normalizePlainObject(actor);

  return {
    globalUserId: normalizeText(safeActor.globalUserId),
    platform: safeActor.platform || "unknown",
    platformUserId: safeActor.platformUserId || null,
    role: safeActor.role || "system",
    isMonarch: Boolean(safeActor.isMonarch),
  };
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createRejectedResult({ reason, errors = [], warnings = [], actor = {} } = {}) {
  return {
    ok: false,
    version: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES.EXPLICIT_RUNTIME_INVOCATION_ONLY,
    decision: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS.REQUEST_REJECTED,
    reason,
    dispatched: false,
    evidenceCollected: false,
    trustedToolDispatched: false,
    trustedEventCreated: false,
    candidatePrepared: false,
    stored: false,
    confirmed: false,
    requiresConfirmation: true,
    evidence: null,
    evidenceResult: null,
    trustedToolResult: null,
    errors,
    warnings,
    actor: normalizeActor(actor),
    boundaries: getRenderEvidenceRuntimeInvocationBridgeBoundaries(),
  };
}

export function getRenderEvidenceRuntimeInvocationBridgeBoundaries() {
  return {
    transportIndependent: true,
    explicitRuntimeInvocationRequestOnly: true,
    connectsRenderEvidenceBridgeToProjectMemoryRuntimeTrustedEventTool: true,
    fetchesRenderOnlyThroughRenderEvidenceBridge: true,
    projectMemoryReceivesSanitizedEvidenceOnly: true,
    writesProjectMemoryOnlyThroughTrustedRuntimeTool: true,
    writesRuntimeFiles: false,
    writesRepository: false,
    changesEnvironment: false,
    touchesTelegram: false,
    callsAI: false,
    emitsRawLogs: false,
    emitsSecrets: false,
    sourceSync: false,
  };
}

export function buildRenderEvidenceRuntimeInvocationBridgeStatus({ renderBridge = null } = {}) {
  const bridge = renderBridge || new RenderEvidenceBridge();
  const diag = typeof bridge.getDiag === "function" ? bridge.getDiag() : {};

  return {
    ok: true,
    service: "RenderEvidenceRuntimeInvocationBridge",
    version: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES.EXPLICIT_RUNTIME_INVOCATION_ONLY,
    canCollectRenderEvidence: true,
    canDispatchToProjectMemoryRuntimeTrustedEventTool: true,
    renderEvidenceReady: Boolean(diag.ready),
    renderEvidenceEnabled: Boolean(diag.enabled),
    boundaries: getRenderEvidenceRuntimeInvocationBridgeBoundaries(),
  };
}

export async function runRenderEvidenceRuntimeInvocationBridge({
  request = {},
  actor = {},
  renderBridge = null,
  confirmation = null,
  createdBy = "render-evidence-runtime-invocation-bridge",
  traceId = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getRenderEvidenceRuntimeInvocationBridgeBoundaries();

  if (safeRequest.explicitRenderEvidenceRuntimeInvocationRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_render_evidence_runtime_invocation_request",
      actor: safeActor,
      errors: [
        createError(
          "missing_explicit_render_evidence_runtime_invocation_request",
          "Render Evidence Runtime Invocation Bridge requires request.explicitRenderEvidenceRuntimeInvocationRequest === true.",
        ),
      ],
    });
  }

  const bridge = renderBridge || new RenderEvidenceBridge();
  const evidenceResult = await bridge.collectDeployLogsEvidence({
    serviceId: safeRequest.serviceId,
    ownerId: safeRequest.ownerId,
    deployId: safeRequest.deployId,
    commit: safeRequest.commit,
    level: safeRequest.level,
    limit: safeRequest.limit,
  });

  if (!evidenceResult?.ok || !evidenceResult.evidence) {
    return {
      ok: false,
      version: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
      mode: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES.EXPLICIT_RUNTIME_INVOCATION_ONLY,
      decision: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS.REQUEST_REJECTED,
      reason: evidenceResult?.reason || "render_evidence_collection_failed",
      dispatched: false,
      evidenceCollected: false,
      trustedToolDispatched: false,
      trustedEventCreated: false,
      candidatePrepared: false,
      stored: false,
      confirmed: false,
      requiresConfirmation: true,
      evidence: null,
      evidenceResult,
      trustedToolResult: null,
      errors: evidenceResult?.errors || [],
      warnings: evidenceResult?.warnings || [],
      actor: safeActor,
      boundaries,
    };
  }

  const runtimeToolResult = await runProjectMemoryRuntimeTrustedEventTool({
    request: {
      explicitRuntimeTrustedEventToolRequest: true,
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
      evidence: evidenceResult.evidence,
      projectKey: normalizeText(safeRequest.projectKey) || "sg",
      moduleKey: normalizeText(safeRequest.moduleKey) || "project_memory",
      stageKey: normalizeText(safeRequest.stageKey) || "stage_07_memory",
      tags: Array.isArray(safeRequest.tags) ? safeRequest.tags : [],
      metadata: normalizePlainObject(safeRequest.metadata),
      traceId: normalizeText(traceId || safeRequest.traceId) || null,
    },
    actor: safeActor,
    confirmation,
    createdBy: normalizeText(createdBy) || "render-evidence-runtime-invocation-bridge",
    traceId: normalizeText(traceId || safeRequest.traceId) || null,
  });

  return {
    ok: Boolean(runtimeToolResult?.ok),
    version: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES.EXPLICIT_RUNTIME_INVOCATION_ONLY,
    decision: runtimeToolResult?.ok
      ? RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS.DISPATCHED
      : RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS.REQUEST_REJECTED,
    reason: runtimeToolResult?.ok ? null : runtimeToolResult?.reason || "project_memory_runtime_trusted_event_tool_failed",
    dispatched: Boolean(runtimeToolResult?.dispatched),
    evidenceCollected: true,
    trustedToolDispatched: Boolean(runtimeToolResult?.dispatched),
    trustedEventCreated: Boolean(runtimeToolResult?.trustedEventCreated),
    candidatePrepared: Boolean(runtimeToolResult?.candidatePrepared),
    stored: Boolean(runtimeToolResult?.stored),
    confirmed: Boolean(runtimeToolResult?.confirmed),
    requiresConfirmation: !runtimeToolResult?.confirmed,
    evidence: evidenceResult.evidence,
    evidenceResult,
    trustedToolResult: runtimeToolResult,
    entry: runtimeToolResult?.entry || null,
    traceId: runtimeToolResult?.traceId || normalizeText(traceId || safeRequest.traceId) || null,
    errors: runtimeToolResult?.errors || [],
    warnings: [
      ...(evidenceResult.warnings || []),
      ...(runtimeToolResult?.warnings || []),
    ],
    actor: safeActor,
    boundaries,
  };
}

export default {
  RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_VERSION,
  RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_MODES,
  RENDER_EVIDENCE_RUNTIME_INVOCATION_BRIDGE_DECISIONS,
  buildRenderEvidenceRuntimeInvocationBridgeStatus,
  getRenderEvidenceRuntimeInvocationBridgeBoundaries,
  runRenderEvidenceRuntimeInvocationBridge,
};
