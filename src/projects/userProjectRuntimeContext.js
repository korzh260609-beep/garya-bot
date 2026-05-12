// src/projects/userProjectRuntimeContext.js
// SG 2.0 — User Project Runtime Context skeleton.
//
// Purpose:
// - Build an explicit runtime context for a user-owned project.
// - Produce the deterministic Project Memory key for explicit user project contexts.
// - Keep user project context selection separate from Telegram, AI, and Project Memory storage.
//
// Hard rules:
// - Do not infer project context from natural-language text here.
// - Do not read or write Project Memory here.
// - Do not confirm Project Memory candidates here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not fetch external sources here.

import { buildUserProjectMemoryKey } from "../memory/project/projectMemoryOwnership.js";
import { UserProjectsStore } from "./userProjectsStore.js";
import { normalizeUserProjectKeyPart } from "./userProjectsTypes.js";

export const USER_PROJECT_RUNTIME_CONTEXT_VERSION = 1;

function normalizeActor(actor = {}) {
  return {
    globalUserId: normalizeUserProjectKeyPart(actor?.globalUserId),
    platform: actor?.platform || "unknown",
    platformUserId: actor?.platformUserId || null,
    role: actor?.role || "guest",
    isMonarch: Boolean(actor?.isMonarch),
  };
}

function normalizeInput(input = {}) {
  return {
    ownerGlobalUserId: normalizeUserProjectKeyPart(input.ownerGlobalUserId),
    userProjectId: normalizeUserProjectKeyPart(input.userProjectId || input.id),
  };
}

export function buildUserProjectRuntimeContextDenied({ reason = "user_project_runtime_context_denied", actor = {}, input = {} } = {}) {
  return {
    ok: false,
    version: USER_PROJECT_RUNTIME_CONTEXT_VERSION,
    reason,
    actor: normalizeActor(actor),
    input: normalizeInput(input),
    project: null,
    projectKey: "",
    boundaries: getUserProjectRuntimeContextBoundaries(),
  };
}

export function getUserProjectRuntimeContextBoundaries() {
  return {
    explicitProjectContextOnly: true,
    infersFromNaturalLanguage: false,
    readsProjectMemory: false,
    writesProjectMemory: false,
    confirmsProjectMemory: false,
    callsAI: false,
    touchesTelegram: false,
    fetchesSources: false,
  };
}

export function buildUserProjectRuntimeContextStatus() {
  return {
    ok: true,
    module: "projects",
    service: "user_project_runtime_context",
    version: USER_PROJECT_RUNTIME_CONTEXT_VERSION,
    runtimeConnected: false,
    boundaries: getUserProjectRuntimeContextBoundaries(),
  };
}

export class UserProjectRuntimeContextResolver {
  constructor({ store = null } = {}) {
    this.store = store || new UserProjectsStore();
  }

  status() {
    return buildUserProjectRuntimeContextStatus();
  }

  async resolveExplicitUserProjectContext({ actor = {}, ownerGlobalUserId = "", userProjectId = "" } = {}) {
    const safeActor = normalizeActor(actor);
    const input = normalizeInput({ ownerGlobalUserId, userProjectId });

    if (!safeActor.globalUserId) {
      return buildUserProjectRuntimeContextDenied({
        reason: "missing_actor_global_user_id",
        actor: safeActor,
        input,
      });
    }

    if (!input.ownerGlobalUserId || !input.userProjectId) {
      return buildUserProjectRuntimeContextDenied({
        reason: "missing_owner_global_user_id_or_user_project_id",
        actor: safeActor,
        input,
      });
    }

    if (!safeActor.isMonarch && safeActor.globalUserId !== input.ownerGlobalUserId) {
      return buildUserProjectRuntimeContextDenied({
        reason: "user_project_runtime_context_owner_mismatch",
        actor: safeActor,
        input,
      });
    }

    const projectResult = await this.store.getProject({
      ownerGlobalUserId: input.ownerGlobalUserId,
      id: input.userProjectId,
    });

    if (!projectResult.ok) {
      return buildUserProjectRuntimeContextDenied({
        reason: projectResult.reason || "user_project_not_found",
        actor: safeActor,
        input,
      });
    }

    const project = projectResult.project;

    if (project.status !== "active") {
      return buildUserProjectRuntimeContextDenied({
        reason: "user_project_not_active",
        actor: safeActor,
        input,
      });
    }

    const memoryKey = buildUserProjectMemoryKey({
      globalUserId: project.ownerGlobalUserId,
      userProjectId: project.id,
    });

    if (!memoryKey.ok) {
      return buildUserProjectRuntimeContextDenied({
        reason: memoryKey.reason || "invalid_user_project_memory_key",
        actor: safeActor,
        input,
      });
    }

    return {
      ok: true,
      version: USER_PROJECT_RUNTIME_CONTEXT_VERSION,
      reason: null,
      actor: safeActor,
      input,
      project,
      projectKey: memoryKey.projectKey,
      boundaries: getUserProjectRuntimeContextBoundaries(),
    };
  }
}

export default UserProjectRuntimeContextResolver;
