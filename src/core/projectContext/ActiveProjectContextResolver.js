// src/core/projectContext/ActiveProjectContextResolver.js
// ============================================================================
// ACTIVE PROJECT CONTEXT RESOLVER
//
// Purpose:
// - resolve the current active project context before meaning/intent decisions.
// - keep project routing context-first, not keyword-first.
// - provide a safe structured default for Monarch private SG development work.
//
// Hard rules:
// - no keyword matching.
// - no regex routing.
// - no DB writes.
// - no AI calls.
// - no repo scans.
// ============================================================================

export const DEFAULT_ACTIVE_PROJECT_CONTEXT = Object.freeze({
  projectKey: "garya-bot",
  projectName: "SG / Советник GARYA",
  repository: "korzh260609-beep/garya-bot",
  ref: "main",
});

function normalizeProvidedActiveProjectContext(value = null, sourceFallback = "provided_active_project_context") {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.active !== true) {
    return null;
  }

  return {
    active: true,
    source: value.source || sourceFallback,
    projectKey: value.projectKey || DEFAULT_ACTIVE_PROJECT_CONTEXT.projectKey,
    projectName: value.projectName || DEFAULT_ACTIVE_PROJECT_CONTEXT.projectName,
    repository: value.repository || DEFAULT_ACTIVE_PROJECT_CONTEXT.repository,
    ref: value.ref || DEFAULT_ACTIVE_PROJECT_CONTEXT.ref,
  };
}

export function resolveActiveProjectContext({
  isMonarchUser = false,
  isPrivateChat = false,
  context = {},
  deps = {},
} = {}) {
  const contextProvided = normalizeProvidedActiveProjectContext(
    context?.activeProjectContext,
    "context_active_project_context"
  );

  if (contextProvided) {
    return contextProvided;
  }

  const depsProvided = normalizeProvidedActiveProjectContext(
    deps?.activeProjectContext,
    "deps_active_project_context"
  );

  if (depsProvided) {
    return depsProvided;
  }

  if (isMonarchUser === true && isPrivateChat === true) {
    return {
      active: true,
      source: "monarch_private_default_project",
      ...DEFAULT_ACTIVE_PROJECT_CONTEXT,
    };
  }

  return {
    active: false,
    source: "no_active_project_context",
    projectKey: null,
    projectName: null,
    repository: null,
    ref: null,
  };
}

export default {
  DEFAULT_ACTIVE_PROJECT_CONTEXT,
  resolveActiveProjectContext,
};
