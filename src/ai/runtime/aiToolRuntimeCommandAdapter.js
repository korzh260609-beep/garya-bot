// src/ai/runtime/aiToolRuntimeCommandAdapter.js
// SG 2.0 — Controlled AI Tool Runtime Command Adapter Skeleton.
// Purpose: adapt an already-structured internal runtime command into the Runtime Invocation Bridge.
// This adapter does not parse raw chat, call AI providers, use function-calling, touch Telegram,
// fetch GitHub/Render/sources, source-sync, write runtime files, mutate repo state, or change env.

import { invokeAiToolFromRuntime } from "./aiToolRuntimeInvocationBridge.js";

export const AI_TOOL_RUNTIME_COMMAND_ADAPTER_VERSION = 1;

export const AI_TOOL_RUNTIME_COMMAND_ADAPTER_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const AI_TOOL_RUNTIME_COMMAND_ADAPTER_DECISIONS = Object.freeze({
  COMMAND_DISPATCHED: "ai_tool_runtime_command_dispatched",
  COMMAND_REJECTED: "ai_tool_runtime_command_rejected",
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

function createRejectedResult({ reason, errors = [], warnings = [], actor = {}, commandName = null, toolName = null } = {}) {
  return {
    ok: false,
    version: AI_TOOL_RUNTIME_COMMAND_ADAPTER_VERSION,
    mode: AI_TOOL_RUNTIME_COMMAND_ADAPTER_MODES.SKELETON_ONLY,
    decision: AI_TOOL_RUNTIME_COMMAND_ADAPTER_DECISIONS.COMMAND_REJECTED,
    reason,
    dispatched: false,
    commandName,
    toolName,
    runtimeInvocation: null,
    errors,
    warnings,
    actor: normalizeActor(actor),
    boundaries: getAiToolRuntimeCommandAdapterBoundaries(),
  };
}

export function getAiToolRuntimeCommandAdapterBoundaries() {
  return {
    internalCommandAdapterOnly: true,
    structuredCommandOnly: true,
    explicitRuntimeCommandRequestOnly: true,
    forwardsToRuntimeInvocationBridge: true,
    parsesRawChat: false,
    touchesTelegram: false,
    callsAI: false,
    usesProviderFunctionCalling: false,
    changesPrompt: false,
    readsRawChat: false,
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

export function buildAiToolRuntimeCommandAdapterStatus() {
  return {
    ok: true,
    module: "ai_runtime",
    service: "AiToolRuntimeCommandAdapter",
    version: AI_TOOL_RUNTIME_COMMAND_ADAPTER_VERSION,
    mode: AI_TOOL_RUNTIME_COMMAND_ADAPTER_MODES.SKELETON_ONLY,
    canAdaptStructuredInternalCommand: true,
    canParseRawChat: false,
    canCallAIProviders: false,
    canUseProviderFunctionCalling: false,
    boundaries: getAiToolRuntimeCommandAdapterBoundaries(),
  };
}

export async function handleAiToolRuntimeCommand({
  command = {},
  actor = {},
  confirmation = null,
  createdBy = "ai-tool-runtime-command-adapter",
  traceId = null,
} = {}) {
  const safeCommand = normalizePlainObject(command);
  const safeActor = normalizeActor(actor);
  const commandName = normalizeText(safeCommand.commandName || safeCommand.name);
  const toolName = normalizeText(safeCommand.toolName);
  const boundaries = getAiToolRuntimeCommandAdapterBoundaries();

  if (safeCommand.explicitRuntimeCommandRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_runtime_command_request",
      actor: safeActor,
      commandName: commandName || null,
      toolName: toolName || null,
      errors: [
        createError(
          "missing_explicit_runtime_command_request",
          "AI Tool Runtime Command Adapter requires command.explicitRuntimeCommandRequest === true.",
        ),
      ],
    });
  }

  if (!commandName) {
    return createRejectedResult({
      reason: "missing_command_name",
      actor: safeActor,
      toolName: toolName || null,
      errors: [
        createError(
          "missing_command_name",
          "AI Tool Runtime Command Adapter requires commandName.",
        ),
      ],
    });
  }

  if (!toolName) {
    return createRejectedResult({
      reason: "missing_tool_name",
      actor: safeActor,
      commandName,
      errors: [
        createError(
          "missing_tool_name",
          "AI Tool Runtime Command Adapter requires toolName.",
        ),
      ],
    });
  }

  const runtimeInvocation = await invokeAiToolFromRuntime({
    request: {
      explicitRuntimeToolInvocationRequest: true,
      toolName,
      input: normalizePlainObject(safeCommand.input),
      ...(safeCommand.traceId ? { traceId: safeCommand.traceId } : {}),
    },
    actor: safeActor,
    confirmation,
    createdBy: normalizeText(createdBy) || "ai-tool-runtime-command-adapter",
    traceId: normalizeText(traceId || safeCommand.traceId) || null,
  });

  return {
    ok: Boolean(runtimeInvocation?.ok),
    version: AI_TOOL_RUNTIME_COMMAND_ADAPTER_VERSION,
    mode: AI_TOOL_RUNTIME_COMMAND_ADAPTER_MODES.SKELETON_ONLY,
    decision: runtimeInvocation?.ok
      ? AI_TOOL_RUNTIME_COMMAND_ADAPTER_DECISIONS.COMMAND_DISPATCHED
      : AI_TOOL_RUNTIME_COMMAND_ADAPTER_DECISIONS.COMMAND_REJECTED,
    reason: runtimeInvocation?.ok ? null : runtimeInvocation?.reason || "runtime_invocation_failed",
    dispatched: Boolean(runtimeInvocation?.ok),
    commandName,
    toolName,
    runtimeInvocation,
    actor: safeActor,
    boundaries,
  };
}

export default {
  AI_TOOL_RUNTIME_COMMAND_ADAPTER_VERSION,
  AI_TOOL_RUNTIME_COMMAND_ADAPTER_MODES,
  AI_TOOL_RUNTIME_COMMAND_ADAPTER_DECISIONS,
  buildAiToolRuntimeCommandAdapterStatus,
  getAiToolRuntimeCommandAdapterBoundaries,
  handleAiToolRuntimeCommand,
};
