// src/core/message/messageProjectMemoryReadBridge.js
// SG 2.0 — Message Project Memory Confirmed Read Bridge.
// Purpose: bridge message runtime to confirmed Project Memory read flow.
// This module has no transport logic, no AI calls, no writes, and no prompt injection.

import { readConfirmedProjectMemoryContext } from "../../memory/index.js";

export const MESSAGE_PROJECT_MEMORY_READ_BRIDGE_VERSION = 1;

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeActor(identity = {}) {
  return {
    globalUserId: identity?.globalUserId || null,
    platform: identity?.platform || "unknown",
    platformUserId: identity?.platformUserId || null,
    role: identity?.role || "guest",
    displayName: identity?.displayName || null,
    isMonarch: Boolean(identity?.isMonarch),
  };
}

function normalizeLimits(limits = {}) {
  return {
    maxEntries: limits.maxEntries,
    maxContentChars: limits.maxContentChars,
    maxTitleChars: limits.maxTitleChars,
  };
}

export function getMessageProjectMemoryReadBridgeBoundaries() {
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

export function buildMessageProjectMemoryReadBridgeStatus() {
  return {
    ok: true,
    module: "core/message",
    service: "MessageProjectMemoryReadBridge",
    version: MESSAGE_PROJECT_MEMORY_READ_BRIDGE_VERSION,
    canReadConfirmedContext: true,
    usesProjectMemoryConfirmedReadFlow: true,
    writesStorage: false,
    promptInjection: false,
    callsAI: false,
    transportConnected: false,
    boundaries: getMessageProjectMemoryReadBridgeBoundaries(),
  };
}

export function buildMessageProjectMemoryReadRequest({ projectKey = "sg", limits = {} } = {}) {
  return {
    explicitReadRequest: true,
    projectKey: normalizeText(projectKey) || "sg",
    limits: normalizeLimits(limits),
  };
}

export async function readMessageProjectMemoryContext({
  identity = {},
  projectKey = "sg",
  limits = {},
  runtimeContext = null,
} = {}) {
  const request = buildMessageProjectMemoryReadRequest({ projectKey, limits });

  return readConfirmedProjectMemoryContext({
    request,
    actor: normalizeActor(identity),
    runtimeContext,
  });
}

export default {
  MESSAGE_PROJECT_MEMORY_READ_BRIDGE_VERSION,
  buildMessageProjectMemoryReadBridgeStatus,
  buildMessageProjectMemoryReadRequest,
  getMessageProjectMemoryReadBridgeBoundaries,
  readMessageProjectMemoryContext,
};
