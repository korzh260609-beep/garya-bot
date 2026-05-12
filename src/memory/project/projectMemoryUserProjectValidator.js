// src/memory/project/projectMemoryUserProjectValidator.js
// SG 2.0 — Project Memory ↔ User Projects Registry validation bridge.
//
// Purpose:
// - Validate that a user_project Project Memory ref points to a real registered user project.
// - Keep validation read-only and separate from memory writes/confirmation.
//
// Hard rules:
// - Do not write Project Memory here.
// - Do not confirm Project Memory candidates here.
// - Do not create user projects here.
// - Do not call AI here.
// - Do not touch Telegram or transport logic here.
// - Do not infer ownership from natural-language phrases.

import { UserProjectsStore } from "../../projects/index.js";
import {
  PROJECT_MEMORY_OWNER_TYPES,
  PROJECT_MEMORY_VISIBILITY,
  buildUserProjectMemoryRef,
  canReadProjectMemory,
  canWriteProjectMemoryCandidate,
  parseProjectMemoryKey,
} from "./projectMemoryOwnership.js";

export const PROJECT_MEMORY_USER_PROJECT_VALIDATOR_VERSION = 1;

export const PROJECT_MEMORY_USER_PROJECT_VALIDATOR_MODES = Object.freeze({
  READ_ONLY: "read_only",
});

function normalizeStore(store) {
  return store || new UserProjectsStore();
}

function safeProjectRef(input = {}) {
  if (input?.projectRef && typeof input.projectRef === "object") return input.projectRef;

  if (input?.projectKey) {
    return parseProjectMemoryKey(input.projectKey);
  }

  return buildUserProjectMemoryRef({
    globalUserId: input?.globalUserId,
    userProjectId: input?.userProjectId,
    visibility: input?.visibility || PROJECT_MEMORY_VISIBILITY.PRIVATE_USER_PROJECT,
  });
}

function inactiveProjectReason(status = "") {
  return status ? `user_project_not_active:${status}` : "user_project_not_active";
}

export class ProjectMemoryUserProjectValidator {
  constructor({ userProjectsStore = null } = {}) {
    this.userProjectsStore = normalizeStore(userProjectsStore);
  }

  status() {
    return {
      ok: true,
      module: "memory.project",
      service: "project_memory_user_project_validator",
      version: PROJECT_MEMORY_USER_PROJECT_VALIDATOR_VERSION,
      mode: PROJECT_MEMORY_USER_PROJECT_VALIDATOR_MODES.READ_ONLY,
      hasUserProjectsRegistryRead: true,
      hasProjectMemoryWrites: false,
      hasProjectMemoryConfirmation: false,
      hasUserProjectWrites: false,
      hasTransportLogic: false,
      hasAICalls: false,
      hasSourceFetching: false,
    };
  }

  getDiagnostics() {
    return {
      ...this.status(),
      boundaries: {
        readsUserProjectsRegistry: true,
        writesProjectMemory: false,
        confirmsProjectMemory: false,
        createsUserProjects: false,
        callsAI: false,
        touchesTelegram: false,
        fetchesSources: false,
        infersOwnershipFromText: false,
      },
      supportedActions: [
        "validate_user_project_ref",
        "validate_user_project_read",
        "validate_user_project_candidate_write",
      ],
      blockedActions: [
        "project_memory_write",
        "project_memory_confirm",
        "user_project_create",
        "ai_call",
        "telegram_command",
        "source_sync",
        "ownership_inference_from_chat_text",
      ],
    };
  }

  async validateUserProjectRef(input = {}) {
    const actor = input?.actor || {};
    const projectRef = safeProjectRef(input);

    if (!projectRef?.ok) {
      return {
        ok: false,
        allowed: false,
        reason: projectRef?.reason || "invalid_project_memory_ref",
        projectRef,
        project: null,
      };
    }

    if (projectRef.ownerType !== PROJECT_MEMORY_OWNER_TYPES.USER_PROJECT) {
      return {
        ok: false,
        allowed: false,
        reason: "project_ref_is_not_user_project",
        projectRef,
        project: null,
      };
    }

    const access = canReadProjectMemory({ actor, projectRef });

    if (!access.allowed) {
      return {
        ok: false,
        allowed: false,
        reason: access.reason || "user_project_memory_access_denied",
        projectRef,
        project: null,
      };
    }

    const projectResult = await this.userProjectsStore.getProject({
      ownerGlobalUserId: projectRef.ownerRef,
      id: projectRef.userProjectId,
    });

    if (!projectResult.ok) {
      return {
        ok: false,
        allowed: false,
        reason: projectResult.reason || "user_project_not_found",
        projectRef,
        project: null,
      };
    }

    if (projectResult.project?.status !== "active") {
      return {
        ok: false,
        allowed: false,
        reason: inactiveProjectReason(projectResult.project?.status),
        projectRef,
        project: projectResult.project,
      };
    }

    return {
      ok: true,
      allowed: true,
      reason: null,
      projectRef,
      project: projectResult.project,
    };
  }

  async validateUserProjectRead(input = {}) {
    return this.validateUserProjectRef(input);
  }

  async validateUserProjectCandidateWrite(input = {}) {
    const actor = input?.actor || {};
    const projectRef = safeProjectRef(input);
    const writeAccess = canWriteProjectMemoryCandidate({ actor, projectRef });

    if (!writeAccess.allowed) {
      return {
        ok: false,
        allowed: false,
        reason: writeAccess.reason || "user_project_memory_write_denied",
        projectRef,
        project: null,
      };
    }

    return this.validateUserProjectRef({ ...input, actor, projectRef });
  }
}

export function createProjectMemoryUserProjectValidator(options = {}) {
  return new ProjectMemoryUserProjectValidator(options);
}

export default ProjectMemoryUserProjectValidator;
