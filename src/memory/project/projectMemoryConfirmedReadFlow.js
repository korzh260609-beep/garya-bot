// src/memory/project/projectMemoryConfirmedReadFlow.js
// SG 2.0 — Confirmed Project Memory Read Flow.
// Purpose: explicit read request -> safe confirmed Project Memory context.
// This module has no transport logic, no AI calls, no writes, and no prompt injection.

import { ProjectMemoryRuntimeContext } from "./projectMemoryRuntimeContext.js";

export const PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION = 1;

export const PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES = Object.freeze({
  EXPLICIT_READ_CONFIRMED_ONLY: "explicit_read_confirmed_only",
});

export const PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS = Object.freeze({
  CONTEXT_BUILT: "confirmed_context_built",
  REQUEST_REJECTED: "confirmed_read_request_rejected",
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

function normalizeInput(input = {}) {
  return input && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeRuntimeContext(runtimeContext) {
  return runtimeContext || new ProjectMemoryRuntimeContext();
}

function normalizeLimits(limits = {}) {
  const safeLimits = normalizeInput(limits);
  return {
    maxEntries: safeLimits.maxEntries,
    maxContentChars: safeLimits.maxContentChars,
    maxTitleChars: safeLimits.maxTitleChars,
  };
}

export function getProjectMemoryConfirmedReadFlowBoundaries() {
  return {
    transportIndependent: true,
    explicitReadRequestOnly: true,
    readsConfirmedOnly: true,
    createsCandidates: false,
    confirmsCandidates: false,
    writesStorage: false,
    infersFromNaturalLanguage: false,
    callsAI: false,
    injectsPromptContext: false,
    fetchesSources: false,
    autoReadsFromChat: false,
    autoWritesFromChat: false,
  };
}

export function buildProjectMemoryConfirmedReadFlowStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryConfirmedReadFlow",
    version: PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
    mode: PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY,
    canReadConfirmedContext: true,
    canCreateCandidate: false,
    canConfirmCandidate: false,
    writesStorage: false,
    autoReadFromChat: false,
    autoWriteFromChat: false,
    promptInjection: false,
    callsAI: false,
    transportConnected: false,
    requiresExplicitReadRequest: true,
    boundaries: getProjectMemoryConfirmedReadFlowBoundaries(),
  };
}

export async function readConfirmedProjectMemoryContext({
  request = {},
  actor = {},
  runtimeContext = null,
} = {}) {
  const safeRequest = normalizeInput(request);
  const safeActor = normalizeActor(actor);
  const boundaries = getProjectMemoryConfirmedReadFlowBoundaries();

  if (safeRequest.explicitReadRequest !== true) {
    return {
      ok: false,
      version: PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
      mode: PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY,
      decision: PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: "missing_explicit_read_request",
      promptInjectionEnabled: false,
      facts: [],
      items: [],
      errors: [
        createError(
          "missing_explicit_read_request",
          "Confirmed Project Memory read requires request.explicitReadRequest === true.",
        ),
      ],
      warnings: [],
      actor: safeActor,
      boundaries,
    };
  }

  const projectKey = normalizeText(safeRequest.projectKey) || "sg";
  const limits = normalizeLimits(safeRequest.limits);
  const contextBridge = normalizeRuntimeContext(runtimeContext);

  const loaded = await contextBridge.buildConfirmedProjectMemoryContextItems({
    projectKey,
    limits,
    actor: safeActor,
  });

  if (!loaded.ok) {
    return {
      ok: false,
      version: PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
      mode: PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY,
      decision: PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS.REQUEST_REJECTED,
      reason: loaded.reason || "confirmed_project_memory_read_failed",
      promptInjectionEnabled: false,
      facts: [],
      items: [],
      loaded,
      errors: loaded.errors || [],
      warnings: loaded.warnings || [],
      actor: safeActor,
      projectKey,
      boundaries,
    };
  }

  return {
    ok: true,
    version: PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
    mode: PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES.EXPLICIT_READ_CONFIRMED_ONLY,
    decision: PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS.CONTEXT_BUILT,
    promptInjectionEnabled: false,
    facts: loaded.facts || [],
    items: loaded.items || [],
    warnings: loaded.warnings || [],
    limits: loaded.limits || limits,
    guard: loaded.guard || null,
    actor: safeActor,
    projectKey,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_VERSION,
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_MODES,
  PROJECT_MEMORY_CONFIRMED_READ_FLOW_DECISIONS,
  buildProjectMemoryConfirmedReadFlowStatus,
  getProjectMemoryConfirmedReadFlowBoundaries,
  readConfirmedProjectMemoryContext,
};
