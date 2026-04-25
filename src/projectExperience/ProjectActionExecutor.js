// src/projectExperience/ProjectActionExecutor.js
// ============================================================================
// STAGE C.6E — Project Action Executor (TRANSPORT-AGNOSTIC SKELETON)
// Purpose:
// - execute confirmed pending project actions by actionType
// - keep execution separated from confirmation, impact analysis and routing
// - prevent arbitrary free-text/action execution
// IMPORTANT:
// - NO GitHub writes here
// - NO arbitrary code execution
// - NO Project Memory writes unless a safe writer is explicitly injected
// - unsupported actionType must fail closed
// ============================================================================

export const PROJECT_ACTION_TYPE = Object.freeze({
  NOOP: "noop",
  PROJECT_MEMORY_WRITE: "project_memory_write",
  CODE_CHANGE: "code_change",
  PROJECT_EXPERIENCE_SYNC: "project_experience_sync",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizePayload(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export class ProjectActionExecutor {
  constructor({ projectMemoryWriter = null, projectExperienceRunner = null } = {}) {
    this.projectMemoryWriter = projectMemoryWriter;
    this.projectExperienceRunner = projectExperienceRunner;
  }

  async execute(pendingAction = {}) {
    const actionType = safeText(pendingAction?.actionType);
    const actionPayload = normalizePayload(pendingAction?.actionPayload);

    switch (actionType) {
      case PROJECT_ACTION_TYPE.NOOP:
        return {
          ok: true,
          executed: true,
          actionType,
          result: "noop_executed",
        };

      case PROJECT_ACTION_TYPE.PROJECT_MEMORY_WRITE:
        return this.executeProjectMemoryWrite({ pendingAction, actionPayload });

      case PROJECT_ACTION_TYPE.PROJECT_EXPERIENCE_SYNC:
        return this.executeProjectExperienceSync({ pendingAction, actionPayload });

      case PROJECT_ACTION_TYPE.CODE_CHANGE:
        return {
          ok: false,
          executed: false,
          actionType,
          reason: "code_change_executor_not_available",
          recommendation: "Use reviewed patch/PR flow instead of direct automatic code execution.",
        };

      default:
        return {
          ok: false,
          executed: false,
          actionType: actionType || "unknown",
          reason: "unsupported_action_type",
        };
    }
  }

  async executeProjectMemoryWrite({ actionPayload = {} } = {}) {
    if (typeof this.projectMemoryWriter !== "function") {
      return {
        ok: false,
        executed: false,
        actionType: PROJECT_ACTION_TYPE.PROJECT_MEMORY_WRITE,
        reason: "project_memory_writer_not_injected",
      };
    }

    const record = normalizePayload(actionPayload?.record);

    if (!safeText(record?.recordType) || !safeText(record?.summary)) {
      return {
        ok: false,
        executed: false,
        actionType: PROJECT_ACTION_TYPE.PROJECT_MEMORY_WRITE,
        reason: "invalid_project_memory_record",
      };
    }

    const saved = await this.projectMemoryWriter(record);

    return {
      ok: true,
      executed: true,
      actionType: PROJECT_ACTION_TYPE.PROJECT_MEMORY_WRITE,
      result: "project_memory_record_written",
      saved,
    };
  }

  async executeProjectExperienceSync({ actionPayload = {} } = {}) {
    if (typeof this.projectExperienceRunner !== "function") {
      return {
        ok: false,
        executed: false,
        actionType: PROJECT_ACTION_TYPE.PROJECT_EXPERIENCE_SYNC,
        reason: "project_experience_runner_not_injected",
      };
    }

    const result = await this.projectExperienceRunner(actionPayload);

    return {
      ok: true,
      executed: true,
      actionType: PROJECT_ACTION_TYPE.PROJECT_EXPERIENCE_SYNC,
      result: "project_experience_sync_executed",
      data: result,
    };
  }
}

export default {
  PROJECT_ACTION_TYPE,
  ProjectActionExecutor,
};
