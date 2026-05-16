// src/ai/runtime/aiToolRuntimeInvocationBridge.js
// SG 2.0 — AI Tool Runtime Invocation Bridge Skeleton.
// Purpose: provide one safe runtime-facing entrypoint for allowlisted AI tools.
// This bridge does not call AI providers, perform function-calling, touch Telegram,
// fetch GitHub/Render/sources, source-sync, write runtime files, mutate repository state, or change env.

import {
  findAiToolManifest,
  runAiTool,
} from "../tools/index.js";

export const AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION = 1;

export const AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS = Object.freeze({
  INVOCATION_DISPATCHED: "ai_tool_runtime_invocation_dispatched",
  INVOCATION_REJECTED: "ai_tool_runtime_invocation_rejected",
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

function createRejectedResult({ reason, errors = [], warnings = [], actor = {}, toolName = null } = {}) {
  return {
    ok: false,
    version: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES.SKELETON_ONLY,
    decision: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS.INVOCATION_REJECTED,
    reason,
    dispatched: false,
    toolName,
    toolResult: null,
    errors,
    warnings,
    actor: normalizeActor(actor),
    boundaries: getAiToolRuntimeInvocationBridgeBoundaries(),
  };
}

export function getAiToolRuntimeInvocationBridgeBoundaries() {
  return {
    runtimeFacingBridgeOnly: true,
    explicitRuntimeInvocationRequestOnly: true,
    allowlistedToolsOnly: true,
    deterministicDispatchOnly: true,
    callsAiToolRegistry: true,
    callsAI: false,
    usesProviderFunctionCalling: false,
    changesPrompt: false,
    readsRawChat: false,
    touchesTelegram: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesSources: false,
    sourceSync: false,
    writesRuntimeFiles: false,
    modifiesRepository: false,
    changesEnvironment: false,
    canAutoConfirmMemory: false,
    writesConfirmedMemory: false,
  };
}

export function buildAiToolRuntimeInvocationBridgeStatus() {
  return {
    ok: true,
    module: "ai_runtime",
    service: "AiToolRuntimeInvocationBridge",
    version: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES.SKELETON_ONLY,
    canDispatchAllowlistedTools: true,
    canCallAIProviders: false,
    canUseProviderFunctionCalling: false,
    boundaries: getAiToolRuntimeInvocationBridgeBoundaries(),
  };
}

export async function invokeAiToolFromRuntime({
  request = {},
  actor = {},
  confirmation = null,
  createdBy = "ai-tool-runtime-invocation-bridge",
  traceId = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const toolName = normalizeText(safeRequest.toolName || safeRequest.name);
  const boundaries = getAiToolRuntimeInvocationBridgeBoundaries();

  if (safeRequest.explicitRuntimeToolInvocationRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_runtime_tool_invocation_request",
      actor: safeActor,
      toolName: toolName || null,
      errors: [
        createError(
          "missing_explicit_runtime_tool_invocation_request",
          "AI Tool Runtime Invocation Bridge requires request.explicitRuntimeToolInvocationRequest === true.",
        ),
      ],
    });
  }

  if (!toolName) {
    return createRejectedResult({
      reason: "missing_tool_name",
      actor: safeActor,
      errors: [
        createError(
          "missing_tool_name",
          "AI Tool Runtime Invocation Bridge requires a toolName.",
        ),
      ],
    });
  }

  const manifest = findAiToolManifest(toolName);
  if (!manifest) {
    return createRejectedResult({
      reason: "runtime_tool_not_allowlisted",
      actor: safeActor,
      toolName,
      errors: [
        createError(
          "runtime_tool_not_allowlisted",
          "AI Tool Runtime Invocation Bridge can dispatch only allowlisted AI tools.",
          { toolName },
        ),
      ],
    });
  }

  const toolResult = await runAiTool({
    request: {
      explicitAiToolRequest: true,
      toolName,
      input: normalizePlainObject(safeRequest.input),
      ...(safeRequest.traceId ? { traceId: safeRequest.traceId } : {}),
    },
    actor: safeActor,
    confirmation,
    createdBy: normalizeText(createdBy) || "ai-tool-runtime-invocation-bridge",
    traceId: normalizeText(traceId || safeRequest.traceId) || null,
  });

  return {
    ok: Boolean(toolResult?.ok),
    version: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION,
    mode: AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES.SKELETON_ONLY,
    decision: toolResult?.ok
      ? AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS.INVOCATION_DISPATCHED
      : AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS.INVOCATION_REJECTED,
    reason: toolResult?.ok ? null : toolResult?.reason || "ai_tool_registry_dispatch_failed",
    dispatched: Boolean(toolResult?.ok),
    toolName,
    manifest,
    toolResult,
    actor: safeActor,
    boundaries,
  };
}

export default {
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_VERSION,
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_MODES,
  AI_TOOL_RUNTIME_INVOCATION_BRIDGE_DECISIONS,
  buildAiToolRuntimeInvocationBridgeStatus,
  getAiToolRuntimeInvocationBridgeBoundaries,
  invokeAiToolFromRuntime,
};
