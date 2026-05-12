// src/core/message/messageProjectMemoryContextGate.js
// SG 2.0 — Message Project Memory Context Gate.
//
// Purpose:
// - Gate optional Project Memory runtime reads for normal message AI requests.
// - Gate optional prompt injection separately from Project Memory reads.
// - Keep default behavior disabled and backward-compatible.
//
// Hard rules:
// - Do not write memory here.
// - Do not confirm candidates here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not fetch external sources here.
// - Do not enable reads or prompt injection by default.

import { envBool, envIntRange } from "../../config/envPrimitives.js";
import {
  ProjectMemoryRuntimeContext,
  buildContextPack,
} from "../../memory/index.js";
import {
  MESSAGE_CONTEXT_INJECTION_MODES,
  buildMessageContextInjectionDisabledOptions,
} from "./messageContextInjection.js";

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
    maxEntries: normalizeLimit(
      limits.maxEntries,
      MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxEntries,
      1,
      20,
    ),
    maxContentChars: normalizeLimit(
      limits.maxContentChars,
      MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxContentChars,
      100,
      4000,
    ),
    maxTitleChars: normalizeLimit(
      limits.maxTitleChars,
      MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.maxTitleChars,
      20,
      400,
    ),
    contextMaxItems: normalizeLimit(
      limits.contextMaxItems,
      MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.contextMaxItems,
      1,
      30,
    ),
    contextMaxChars: normalizeLimit(
      limits.contextMaxChars,
      MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS.contextMaxChars,
      200,
      4000,
    ),
  };
}

function buildTaskIntent(text = "") {
  return normalizeText(text) ? "normal_message_ai_request" : null;
}

function buildUserIdentity(identity = {}) {
  const globalUserId = identity?.globalUserId || null;
  const platformUserId = identity?.platformUserId || null;

  return {
    globalUserId,
    platform: identity?.platform || "unknown",
    platformUserId,
    role: identity?.role || "guest",
    displayName: identity?.displayName || null,
    isMonarch: Boolean(identity?.isMonarch),
  };
}

function buildSessionContext(behaviorRuntime = null) {
  return behaviorRuntime
    ? [
        {
          content: "Message behavior runtime was evaluated before AI call.",
          source: "core_message_behavior_runtime",
          metadata: {
            hasBehaviorRuntime: true,
            mode: behaviorRuntime?.mode || null,
          },
        },
      ]
    : [];
}

export function buildMessageProjectMemoryContextGateDisabledOptions() {
  return {
    enabled: false,
    injectIntoPrompt: false,
    projectKey: "sg",
    limits: { ...MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_DEFAULT_LIMITS },
  };
}

export function getMessageProjectMemoryContextGateOptionsFromEnv() {
  return {
    enabled: envBool("SG_PROJECT_MEMORY_CONTEXT_ENABLED", false),
    injectIntoPrompt: envBool("SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED", false),
    projectKey: "sg",
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
  const limits = normalizeLimits(options.limits || disabled.limits);

  return {
    enabled: Boolean(options.enabled),
    injectIntoPrompt: Boolean(options.injectIntoPrompt),
    projectKey: normalizeText(options.projectKey) || disabled.projectKey,
    limits,
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
    limits: {
      maxItems: limits.contextMaxItems,
      maxChars: limits.contextMaxChars,
    },
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
    limits: {
      maxItems: limits.contextMaxItems,
      maxChars: limits.contextMaxChars,
    },
  });
}

function buildInjectionOptions({ injectIntoPrompt = false } = {}) {
  if (!injectIntoPrompt) {
    return buildMessageContextInjectionDisabledOptions();
  }

  return {
    enabled: true,
    mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
    formatterOptions: {
      limits: {
        maxItems: 12,
        maxTotalChars: 4000,
        maxItemChars: 800,
      },
    },
  };
}

export async function prepareMessageProjectMemoryContextGate({
  identity = {},
  text = "",
  behaviorRuntime = null,
  options = {},
  runtimeContext = null,
} = {}) {
  const normalizedOptions = normalizeOptions(options);
  const baseContextPack = buildBaseContextPack({
    identity,
    text,
    behaviorRuntime,
    limits: normalizedOptions.limits,
  });

  if (!normalizedOptions.enabled) {
    return {
      ok: true,
      version: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
      mode: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.DISABLED,
      readAttempted: false,
      readOk: null,
      projectMemoryFactsCount: 0,
      contextPack: baseContextPack,
      contextInjectionOptions: buildMessageContextInjectionDisabledOptions(),
      warnings: [],
    };
  }

  const reader = runtimeContext || new ProjectMemoryRuntimeContext();
  const loaded = await reader.loadConfirmedProjectMemoryFacts({
    projectKey: normalizedOptions.projectKey,
    limits: normalizedOptions.limits,
    actor: buildUserIdentity(identity),
  });

  if (!loaded.ok) {
    return {
      ok: false,
      version: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_VERSION,
      mode: MESSAGE_PROJECT_MEMORY_CONTEXT_GATE_MODES.READ_ONLY,
      readAttempted: true,
      readOk: false,
      reason: loaded.reason || "project_memory_runtime_read_failed",
      projectMemoryFactsCount: 0,
      contextPack: baseContextPack,
      contextInjectionOptions: buildMessageContextInjectionDisabledOptions(),
      warnings: loaded.warnings || [],
      storage: loaded.storage || null,
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
    projectMemoryFactsCount: Array.isArray(loaded.facts) ? loaded.facts.length : 0,
    contextPack,
    contextInjectionOptions: buildInjectionOptions({ injectIntoPrompt: normalizedOptions.injectIntoPrompt }),
    warnings: loaded.warnings || [],
    limits: normalizedOptions.limits,
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
