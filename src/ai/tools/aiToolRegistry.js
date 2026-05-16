// src/ai/tools/aiToolRegistry.js
// SG 2.0 — AI Tool Registry Skeleton.
// Purpose: expose internal safe tools to future AI orchestration through a small deterministic registry.
// This registry does not call AI, Telegram, GitHub, Render, source sync, runtime writers, or env mutation.
// Tool execution is explicit-only and delegates to isolated internal handlers.

import {
  runProjectMemoryRuntimeTrustedEventTool,
} from "../../memory/index.js";

export const AI_TOOL_REGISTRY_VERSION = 1;

export const AI_TOOL_REGISTRY_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const AI_TOOL_NAMES = Object.freeze({
  PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT: "project_memory.runtime_trusted_event",
});

export const AI_TOOL_REGISTRY_DECISIONS = Object.freeze({
  TOOL_DISPATCHED: "ai_tool_dispatched",
  TOOL_REJECTED: "ai_tool_rejected",
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
    version: AI_TOOL_REGISTRY_VERSION,
    mode: AI_TOOL_REGISTRY_MODES.SKELETON_ONLY,
    decision: AI_TOOL_REGISTRY_DECISIONS.TOOL_REJECTED,
    reason,
    dispatched: false,
    toolName: null,
    result: null,
    errors,
    warnings,
    actor: normalizeActor(actor),
    boundaries: getAiToolRegistryBoundaries(),
  };
}

export function getAiToolRegistryBoundaries() {
  return {
    registryOnly: true,
    explicitToolRequestOnly: true,
    deterministicDispatchOnly: true,
    callsAI: false,
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

export function listAiToolManifests() {
  return [
    {
      name: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
      title: "Project Memory Runtime Trusted Event",
      description: "Create a durable pending Project Memory candidate from an already-trusted project event.",
      inputMode: "trusted_project_event_only",
      outputMode: "durable_pending_candidate_only",
      boundaries: {
        requiresExplicitRuntimeTrustedEventToolRequest: true,
        autoConfirm: false,
        writesConfirmedMemory: false,
        callsAI: false,
        touchesTelegram: false,
        fetchesGitHub: false,
        fetchesRender: false,
        sourceSync: false,
      },
    },
  ];
}

export function buildAiToolRegistryStatus() {
  return {
    ok: true,
    module: "ai_tools",
    service: "AiToolRegistry",
    version: AI_TOOL_REGISTRY_VERSION,
    mode: AI_TOOL_REGISTRY_MODES.SKELETON_ONLY,
    toolsCount: listAiToolManifests().length,
    toolNames: listAiToolManifests().map((tool) => tool.name),
    boundaries: getAiToolRegistryBoundaries(),
  };
}

export function findAiToolManifest(toolName) {
  const safeToolName = normalizeText(toolName);
  return listAiToolManifests().find((tool) => tool.name === safeToolName) || null;
}

export async function runAiTool({
  request = {},
  actor = {},
  confirmation = null,
  createdBy = "ai-tool-registry",
  traceId = null,
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safeActor = normalizeActor(actor);
  const toolName = normalizeText(safeRequest.toolName || safeRequest.name);
  const boundaries = getAiToolRegistryBoundaries();

  if (safeRequest.explicitAiToolRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_ai_tool_request",
      actor: safeActor,
      errors: [
        createError(
          "missing_explicit_ai_tool_request",
          "AI tool registry requires request.explicitAiToolRequest === true.",
        ),
      ],
    });
  }

  if (!toolName || !findAiToolManifest(toolName)) {
    return createRejectedResult({
      reason: "unknown_ai_tool",
      actor: safeActor,
      errors: [
        createError(
          "unknown_ai_tool",
          "AI tool registry can dispatch only allowlisted tools.",
          { toolName },
        ),
      ],
    });
  }

  if (toolName === AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT) {
    const result = await runProjectMemoryRuntimeTrustedEventTool({
      request: {
        ...normalizePlainObject(safeRequest.input),
        explicitRuntimeTrustedEventToolRequest: true,
      },
      actor: safeActor,
      confirmation,
      createdBy: normalizeText(createdBy) || "ai-tool-registry",
      traceId: normalizeText(traceId || safeRequest.traceId) || null,
    });

    return {
      ok: Boolean(result?.ok),
      version: AI_TOOL_REGISTRY_VERSION,
      mode: AI_TOOL_REGISTRY_MODES.SKELETON_ONLY,
      decision: result?.ok
        ? AI_TOOL_REGISTRY_DECISIONS.TOOL_DISPATCHED
        : AI_TOOL_REGISTRY_DECISIONS.TOOL_REJECTED,
      reason: result?.ok ? null : result?.reason || "tool_execution_failed",
      dispatched: Boolean(result?.ok),
      toolName,
      result,
      actor: safeActor,
      boundaries,
    };
  }

  return createRejectedResult({
    reason: "ai_tool_not_implemented",
    actor: safeActor,
    errors: [
      createError(
        "ai_tool_not_implemented",
        "AI tool is allowlisted but has no dispatcher implementation.",
        { toolName },
      ),
    ],
  });
}

export default {
  AI_TOOL_REGISTRY_VERSION,
  AI_TOOL_REGISTRY_MODES,
  AI_TOOL_NAMES,
  AI_TOOL_REGISTRY_DECISIONS,
  buildAiToolRegistryStatus,
  getAiToolRegistryBoundaries,
  listAiToolManifests,
  findAiToolManifest,
  runAiTool,
};
