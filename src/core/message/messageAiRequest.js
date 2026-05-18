// AGENT NOTE:
// SG 2.0 message AI request builder.
// Purpose: isolate AI request construction for normal text messages from handleMessage.
// Do not add OpenAI client logic, tool execution, transport logic, access checks, or deterministic pre-AI routes here.
// Memory/Context injection must pass through messageContextInjection boundary and stay disabled unless explicitly approved.

import { callAI } from "../../ai/callAI.js";
import { buildSgSystemPrompt } from "../sgSystemPrompt.js";
import { prepareMessageContextInjection } from "./messageContextInjection.js";
import {
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
} from "./messageProjectMemoryContextGate.js";

export const PROJECT_MEMORY_RUNTIME_VERIFICATION_LOG_VERSION = 1;

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeWarningCodes(warnings = []) {
  return Array.isArray(warnings)
    ? warnings.map((warning) => safeString(warning?.code || warning)).filter(Boolean).slice(0, 12)
    : [];
}

function countContextItems(contextPack = null) {
  return Array.isArray(contextPack?.items) ? contextPack.items.length : 0;
}

function countMessages(contextInjection = null) {
  return Array.isArray(contextInjection?.messages) ? contextInjection.messages.length : 0;
}

export function buildProjectMemoryRuntimeVerificationLog({
  projectMemoryContextGate = null,
  contextInjection = null,
  explicitProjectContext = null,
} = {}) {
  const gate = projectMemoryContextGate || {};

  return {
    ok: Boolean(gate.ok),
    type: "project_memory_runtime_verification",
    version: PROJECT_MEMORY_RUNTIME_VERIFICATION_LOG_VERSION,
    source: "core.message.callMessageAI",
    mode: safeString(gate.mode || "unknown"),
    enabled: gate.mode !== "disabled",
    readAttempted: Boolean(gate.readAttempted),
    readOk: gate.readOk === null || gate.readOk === undefined ? null : Boolean(gate.readOk),
    projectKey: safeString(gate.projectKey || ""),
    projectMemoryFactsCount: Number.isFinite(Number(gate.projectMemoryFactsCount))
      ? Number(gate.projectMemoryFactsCount)
      : 0,
    contextPackItemsCount: countContextItems(gate.contextPack),
    promptInjectionEnabled: Boolean(contextInjection?.enabled),
    injectedMessageCount: countMessages(contextInjection),
    explicitProjectContextUsed: Boolean(gate.projectSelection?.explicitProjectContextUsed),
    explicitProjectContextProvided: Boolean(explicitProjectContext),
    reason: safeString(gate.reason || ""),
    warningCodes: normalizeWarningCodes(gate.warnings),
    sanitized: true,
  };
}

export function emitProjectMemoryRuntimeVerificationLog({
  projectMemoryContextGate = null,
  contextInjection = null,
  explicitProjectContext = null,
  logger = console,
} = {}) {
  const record = buildProjectMemoryRuntimeVerificationLog({
    projectMemoryContextGate,
    contextInjection,
    explicitProjectContext,
  });

  try {
    logger?.info?.("project_memory_runtime_verification", JSON.stringify(record));
  } catch {
    // Runtime verification logs must never break normal message handling.
  }

  return record;
}

export async function callMessageAI({ identity, text, behaviorRuntime, explicitProjectContext = null, logger = console }) {
  const projectMemoryContextGate = await prepareMessageProjectMemoryContextGate({
    identity,
    text,
    behaviorRuntime,
    options: getMessageProjectMemoryContextGateOptionsFromEnv(),
    explicitProjectContext,
  });
  const contextPack = projectMemoryContextGate.contextPack;
  const baseMessages = [
    { role: "system", content: buildSgSystemPrompt(identity) },
    { role: "user", content: text },
  ];
  const contextInjection = prepareMessageContextInjection({
    messages: baseMessages,
    contextPack,
    options: projectMemoryContextGate.contextInjectionOptions,
  });

  const projectMemoryRuntimeVerification = emitProjectMemoryRuntimeVerificationLog({
    projectMemoryContextGate,
    contextInjection,
    explicitProjectContext,
    logger,
  });

  return callAI(
    contextInjection.messages,
    {
      maxOutputTokens: 500,
      identity,
      latestUserText: text,
      behaviorRuntime,
      contextPack,
      contextInjection,
      projectMemoryContextGate,
      projectMemoryRuntimeVerification,
      returnMetadata: true,
    }
  );
}