// src/core/runtime/messageRuntimeContextResolver.js
// SG 2.0 — Message Runtime Context Resolver.
//
// Purpose:
// - Build message runtime options before the AI request.
// - Keep explicit project context resolution transport-independent.
// - Bridge explicit user project runtime requests into runtimeOptions.explicitProjectContext.
//
// Hard rules:
// - Do not infer project context from natural-language text.
// - Do not add Telegram, web, API, or any transport-specific logic here.
// - Do not read or write Project Memory here.
// - Do not confirm Project Memory candidates here.
// - Do not call AI here.
// - Do not inject context into prompts here.
// - Do not fetch external sources here.

import { UserProjectRuntimeContextResolver } from "../../projects/index.js";

export const MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION = 1;

function normalizeExplicitProjectContextOption(context = {}) {
  const explicitProjectContext = context?.runtimeOptions?.explicitProjectContext;

  if (!explicitProjectContext || typeof explicitProjectContext !== "object") {
    return null;
  }

  return explicitProjectContext;
}

function normalizeExplicitUserProjectRequest(context = {}) {
  const request = context?.runtimeOptions?.explicitUserProjectContextRequest;

  if (!request || typeof request !== "object") {
    return null;
  }

  return {
    ownerGlobalUserId: request.ownerGlobalUserId || "",
    userProjectId: request.userProjectId || request.id || "",
  };
}

function buildActorFromIdentity(identity = {}) {
  return {
    globalUserId: identity?.globalUserId || "",
    platform: identity?.platform || "unknown",
    platformUserId: identity?.platformUserId || null,
    role: identity?.role || "guest",
    isMonarch: Boolean(identity?.isMonarch),
  };
}

export function getMessageRuntimeContextResolverBoundaries() {
  return {
    transportIndependent: true,
    explicitProjectContextOnly: true,
    infersFromNaturalLanguage: false,
    readsProjectMemory: false,
    writesProjectMemory: false,
    confirmsProjectMemory: false,
    callsAI: false,
    injectsPromptContext: false,
    fetchesSources: false,
  };
}

export function buildMessageRuntimeContextResolverStatus() {
  return {
    ok: true,
    module: "core/runtime",
    service: "message_runtime_context_resolver",
    version: MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
    boundaries: getMessageRuntimeContextResolverBoundaries(),
  };
}

export async function resolveMessageRuntimeOptions({
  context = {},
  identity = {},
  userProjectRuntimeContextResolver = null,
} = {}) {
  const directExplicitProjectContext = normalizeExplicitProjectContextOption(context);

  if (directExplicitProjectContext) {
    return {
      ok: true,
      version: MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
      explicitProjectContext: directExplicitProjectContext,
      explicitProjectContextSource: "runtime_options_explicit_project_context",
      warnings: [],
      boundaries: getMessageRuntimeContextResolverBoundaries(),
    };
  }

  const explicitUserProjectRequest = normalizeExplicitUserProjectRequest(context);

  if (!explicitUserProjectRequest) {
    return {
      ok: true,
      version: MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
      explicitProjectContext: null,
      explicitProjectContextSource: null,
      warnings: [],
      boundaries: getMessageRuntimeContextResolverBoundaries(),
    };
  }

  const resolver = userProjectRuntimeContextResolver || new UserProjectRuntimeContextResolver();
  const resolved = await resolver.resolveExplicitUserProjectContext({
    actor: buildActorFromIdentity(identity),
    ownerGlobalUserId: explicitUserProjectRequest.ownerGlobalUserId,
    userProjectId: explicitUserProjectRequest.userProjectId,
  });

  if (!resolved.ok) {
    return {
      ok: true,
      version: MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
      explicitProjectContext: null,
      explicitProjectContextSource: null,
      warnings: [
        {
          code: "explicit_user_project_context_request_denied",
          reason: resolved.reason || "unknown_reason",
        },
      ],
      boundaries: getMessageRuntimeContextResolverBoundaries(),
    };
  }

  return {
    ok: true,
    version: MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
    explicitProjectContext: resolved,
    explicitProjectContextSource: "explicit_user_project_context_request",
    warnings: [],
    boundaries: getMessageRuntimeContextResolverBoundaries(),
  };
}

export default {
  MESSAGE_RUNTIME_CONTEXT_RESOLVER_VERSION,
  buildMessageRuntimeContextResolverStatus,
  getMessageRuntimeContextResolverBoundaries,
  resolveMessageRuntimeOptions,
};
