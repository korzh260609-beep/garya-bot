// src/core/message/messageProjectMemoryContextGate.js

import { envBool, envIntRange } from "../../config/envPrimitives.js";
import {
  PROJECT_MEMORY_OWNER_TYPES,
  SG_PROJECT_MEMORY_KEY,
  buildContextPack,
  parseProjectMemoryKey,
} from "../../memory/index.js";
import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  buildMessageContextInjectionDisabledOptions,
} from "./messageContextInjection.js";
import { readMessageProjectMemoryContext } from "./messageProjectMemoryReadBridge.js";

export const MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION = 1;

export const MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES = Object.freeze({
  DISABLED: "disabled",
  READ_ONLY: "read_only",
  READ_AND_INJECT: "read_and_inject",
});

export const MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS = Object.freeze({
  maxEntries: 5,
  maxContentChars: 1200,
  maxTitleChars: 160,
  contextMaxItems: 14,
  contextMaxChars: 1200,
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeLimits(limits = {}) {
  return {
    maxEntries: normalizeLimit(limits.maxEntries, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxEntries, 1, 20),
    maxContentChars: normalizeLimit(limits.maxContentChars, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxContentChars, 100, 4000),
    maxTitleChars: normalizeLimit(limits.maxTitleChars, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxTitleChars, 20, 400),
    contextMaxItems: normalizeLimit(limits.contextMaxItems, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.contextMaxItems, 1, 30),
    contextMaxChars: normalizeLimit(limits.contextMaxChars, MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.contextMaxChars, 200, 4000),
  };
}

function buildTaskIntent(text = "") {
  return normalizeText(text) ? "normal_message_ai_request" : null;
}

function buildUserIdentity(identity = {}) {
  return {
    globalUserId: identity?.globalUserId || null,
    platform: identity?.platform || "unknown",
    platformUserId: identity?.platformUserId || null,
    role: identity?.role || "guest",
    displayName: identity?.displayName || null,
    isMonarch: Boolean(identity?.isMonarch),
  };
}

function buildSessionContext(behaviorRuntime = null) {
  return behaviorRuntime
    ? [{
        content: "Message behavior runtime was evaluated before AI call.",
        source: "core_message_behavior_runtime",
        metadata: { hasBehaviorRuntime: true, mode: behaviorRuntime?.mode || null },
      }]
    : [];
}

function isUserProjectMemoryKey(projectKey = "") {
  const projectRef = parseProjectMemoryKey(projectKey);
  return Boolean(projectRef?.ok && projectRef.ownerType === PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT);
}

function normalizeExplicitProjectContext(explicitProjectContext = null) {
  if (!explicitProjectContext || typeof explicitProjectContext !== "object") {
    return { ok: false, reason: "missing_explicit_project_context", projectKey: "", context: null };
  }
  if (explicitProjectContext.ok !== true) {
    return { ok: false, reason: explicitProjectContext.reason || "explicit_project_context_not_ok", projectKey: "", context: explicitProjectContext };
  }

  const projectKey = normalizeText(explicitProjectContext.projectKey);
  const projectRef = parseProjectMemoryKey(projectKey);
  if (!projectRef?.ok || projectRef.ownerType !== PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT) {
    return { ok: false, reason: projectRef?.reason || "explicit_project_context_not_user_project", projectKey: "", context: explicitProjectContext };
  }

  return { ok: true, reason: null, projectKey: projectRef.projectKey, context: explicitProjectContext };
}

function resolveProjectMemoryProjectSelection({ requestedProjectKey = SG_PROJECT_MEMORY_KEY, explicitProjectContext = null } = {}) {
  const requested = normalizeText(requestedProjectKey) || SG_PROJECT_MEMORY_KEY;
  const explicit = normalizeExplicitProjectContext(explicitProjectContext);

  if (explicit.ok) {
    return { ok: true, projectKey: explicit.projectKey, explicitProjectContextUsed: true, requestedProjectKey: requested, warnings: [] };
  }

  if (isUserProjectMemoryKey(requested)) {
    return {
      ok: true,
      projectKey: SG_PROJECT_MEMORY_KEY,
      explicitProjectContextUsed: false,
      requestedProjectKey: requested,
      warnings: [{
        code: "user_project_project_key_requires_explicit_context",
        message: "User project Project Memory reads require an explicit resolved project context.",
        requestedProjectKey: requested,
        explicitProjectContextReason: explicit.reason,
      }],
    };
  }

  if (requested !== SG_PROJECT_MEMORY_KEY) {
    return {
      ok: true,
      projectKey: SG_PROJECT_MEMORY_KEY,
      explicitProjectContextUsed: false,
      requestedProjectKey: requested,
      warnings: [{
        code: "unsupported_project_memory_key_fallback_to_sg",
        message: "Only sg Project Memory is selected by default; user_project requires explicit context.",
        requestedProjectKey: requested,
      }],
    };
  }

  return { ok: true, projectKey: SG_PROJECT_MEMORY_KEY, explicitProjectContextUsed: false, requestedProjectKey: requested, warnings: [] };
}

export function buildMessageProjectMemoryContextGateDisabledOptions() {
  return {
    enabled: false,
    injectIntoPrompt: false,
    projectKey: SG_PROJECT_MEMORY_KEY,
    limits: { ...MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS },
  };
}

export function getMessageProjectMemoryContextGateOptionsFromEnv() {
  return {
    enabled: envBool("SG_PROJECT_MEMORY_CONTEXT_ENABLED", false),
    injectIntoPrompt: envBool("SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED", false),
    projectKey: SG_PROJECT_MEMORY_KEY,
    limits: {
      maxEntries: envIntRange("SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES", 5, { min: 1, max: 20 }),
      maxContentChars: envIntRange("SG_PROJECT_MEMORY_CONTEXT_MAX_CONTENT_CHARS", 1200, { min: 100, max: 4000 }),
      maxTitleChars: envIntRange("SG_PROJECT_MEMORY_CONTEXT_MAX_TITLE_CHARS", 160, { min: 20, max: 400 }),
      contextMaxItems: envIntRange("SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS", 14, { min: 1, max: 30 }),
      contextMaxChars: envIntRange("SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS", 1200, { min: 200, max: 4000 }),
    },
  };
}

function normalizeOptions(options = {}) {
  const disabled = buildMessageProjectMemoryContextGateDisabledOptions();
  return {
    enabled: Boolean(options.enabled),
    injectIntoPrompt: Boolean(options.injectIntoPrompt),
    projectKey: normalizeText(options.projectKey) || disabled.projectKey,
    limits: normalizeLimits(options.limits || disabled.limits),
  };
}

function buildBaseContextPack({ identity = {}, text = "", behaviorRuntime = null, limits = {} } = {}) {
  const userIdentity = buildUserIdentity(identity);
  return buildContextPack({
    userId: userIdentity.globalUserId,
    chatId: null,
    userMessage: text,
    userIdentity,
    taskIntent: buildTaskIntent(text),
    sessionContext: buildSessionContext(behaviorRuntime),
    limits: { maxItems: limits.contextMaxItems, maxChars: limits.contextMaxChars },
  });
}

function buildContextPackWithProjectMemory({ identity = {}, text = "", behaviorRuntime = null, projectMemoryFacts = [], limits = {} } = {}) {
  const userIdentity = buildUserIdentity(identity);
  return buildContextPack({
    userId: userIdentity.globalUserId,
    chatId: null,
    userMessage: text,
    userIdentity,
    taskIntent: buildTaskIntent(text),
    projectMemory: projectMemoryFacts,
    sessionContext: buildSessionContext(behaviorRuntime),
    limits: { maxItems: limits.contextMaxItems, maxChars: limits.contextMaxChars },
  });
}

function buildInjectionOptions({ injectIntoPrompt = false } = {}) {
  if (!injectIntoPrompt) return buildMessageContextInjectionDisabledOptions();
  return {
    enabled: true,
    mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
    formatterOptions: { limits: { maxItems: 12, maxTotalChars: 4000, maxItemChars: 800 } },
  };
}

export async function prepareMessageProjectMemoryContextGate({
  identity = {},
  text = "",
  behaviorRuntime = null,
  options = {},
  runtimeContext = null,
  explicitProjectContext = null,
} = {}) {
  const normalizedOptions = normalizeOptions(options);
  const projectSelection = resolveProjectMemoryProjectSelection({ requestedProjectKey: normalizedOptions.projectKey, explicitProjectContext });
  const baseContextPack = buildBaseContextPack({ identity, text, behaviorRuntime, limits: normalizedOptions.limits });

  if (!normalizedOptions.enabled) {
    return {
      ok: true,
      version: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
      mode: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.DISABLED,
      readAttempted: false,
      readOk: null,
      projectKey: projectSelection.projectKey,
      projectSelection,
      projectMemoryFactsCount: 0,
      contextPack: baseContextPack,
      contextInjectionOptions: buildMessageContextInjectionDisabledOptions(),
      warnings: [],
    };
  }

  const loaded = await readMessageProjectMemoryContext({
    identity,
    projectKey: projectSelection.projectKey,
    limits: normalizedOptions.limits,
    runtimeContext,
  });

  if (!loaded.ok) {
    return {
      ok: false,
      version: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
      mode: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_ONLY,
      readAttempted: true,
      readOk: false,
      projectKey: projectSelection.projectKey,
      projectSelection,
      reason: loaded.reason || "project_memory_runtime_read_failed",
      projectMemoryFactsCount: 0,
      contextPack: baseContextPack,
      contextInjectionOptions: buildMessageContextInjectionDisabledOptions(),
      warnings: [...projectSelection.warnings, ...(loaded.warnings || [])],
      storage: loaded.storage || null,
      readBridge: loaded,
    };
  }

  const contextPack = buildContextPackWithProjectMemory({
    identity,
    text,
    behaviorRuntime,
    projectMemoryFacts: loaded.facts || [],
    limits: normalizedOptions.limits,
  });

  const mode = normalizedOptions.injectIntoPrompt
    ? MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_AND_INJECT
    : MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_ONLY;

  return {
    ok: true,
    version: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
    mode,
    readAttempted: true,
    readOk: true,
    projectKey: projectSelection.projectKey,
    projectSelection,
    projectMemoryFactsCount: Array.isArray(loaded.facts) ? loaded.facts.length : 0,
    contextPack,
    contextInjectionOptions: buildInjectionOptions({ injectIntoPrompt: normalizedOptions.injectIntoPrompt }),
    warnings: [...projectSelection.warnings, ...(loaded.warnings || [])],
    limits: normalizedOptions.limits,
    readBridge: loaded,
  };
}

export default {
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES,
  MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS,
  buildMessageProjectMemoryContextGateDisabledOptions,
  getMessageProjectMemoryContextGateOptionsFromEnv,
  prepareMessageProjectMemoryContextGate,
};
