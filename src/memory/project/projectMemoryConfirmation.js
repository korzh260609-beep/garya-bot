// src/memory/project/projectMemoryConfirmation.js
// SG 2.0 — Project Memory confirmation boundary.
// Purpose: connect safe candidate preparation to explicit durable confirmation flow.
// Do not add Telegram logic, AI calls, source sync, automatic chat extraction, cron/timers, or transport handling here.

import { PROJECT_MEMORY_TRUST } from "./projectMemoryTypes.js";
import { ProjectMemoryService } from "./projectMemoryService.js";
import { ProjectMemoryStore } from "./projectMemoryStore.js";
import { ProjectMemoryUserProjectValidator } from "./projectMemoryUserProjectValidator.js";

export const PROJECT_MEMORY_CONFIRMATION_VERSION = 1;

export const PROJECT_MEMORY_CONFIRMATION_MODES = Object.freeze({
  EXPLICIT_ONLY: "explicit_only",
});

export const PROJECT_MEMORY_CONFIRMATION_DECISIONS = Object.freeze({
  CANDIDATE_CREATED: "candidate_created_for_confirmation",
  CANDIDATE_REJECTED: "candidate_rejected_before_storage",
  CONFIRMED: "confirmed",
  NOT_CONFIRMED: "not_confirmed",
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeStore(store) {
  return store || new ProjectMemoryStore();
}

function normalizeService(service) {
  return service || new ProjectMemoryService();
}

function normalizeUserProjectValidator(userProjectValidator) {
  return userProjectValidator || new ProjectMemoryUserProjectValidator();
}

function isUserProjectKey(projectKey = "") {
  return normalizeText(projectKey).startsWith("user_project:");
}

export class ProjectMemoryConfirmation {
  constructor({ service = null, store = null, userProjectValidator = null, logger = null } = {}) {
    this.service = normalizeService(service);
    this.store = normalizeStore(store);
    this.userProjectValidator = normalizeUserProjectValidator(userProjectValidator);
    this.logger = logger || console;
  }

  status() {
    return {
      ok: true,
      module: "project_memory",
      service: "ProjectMemoryConfirmation",
      version: PROJECT_MEMORY_CONFIRMATION_VERSION,
      mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
      hasDbBoundary: true,
      hasUserProjectValidationGuard: true,
      canCreateCandidateForConfirmation: true,
      canConfirmCandidate: true,
      canListConfirmedEntries: true,
      autoWriteFromChat: false,
      autoWriteFromAI: false,
      sourceSync: false,
      telegramConnected: false,
      callsAI: false,
      requiresExplicitCaller: true,
      requiresExternalApprovalDecision: true,
    };
  }

  getDiagnostics() {
    return {
      ok: true,
      module: "project_memory",
      service: "ProjectMemoryConfirmation",
      version: PROJECT_MEMORY_CONFIRMATION_VERSION,
      mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
      boundaries: {
        usesProjectMemoryServiceValidation: true,
        usesProjectMemoryStore: true,
        usesUserProjectValidationGuard: true,
        transportIndependent: true,
        aiIndependent: true,
        sourceSyncIndependent: true,
      },
      sideEffects: {
        canWriteCandidateOnlyWhenExplicitlyCalled: true,
        canConfirmOnlyWhenExplicitlyCalled: true,
        validatesUserProjectBeforeUserProjectCandidateWrite: true,
        autoWritesFromChat: false,
        callsAI: false,
        touchesTelegram: false,
        fetchesSources: false,
        writesRuntimeFiles: false,
        modifiesRepository: false,
      },
      supportedActions: [
        "status",
        "getDiagnostics",
        "prepareCandidateForConfirmation",
        "confirmCandidate",
        "listConfirmedEntries",
      ],
      blockedActions: [
        "auto_write_from_chat",
        "ai_auto_write",
        "source_sync",
        "telegram_command",
        "raw_log_storage",
        "secret_storage",
        "cron_confirmation",
      ],
    };
  }

  async validateUserProjectCandidateGuard({ actor = {}, projectKey = "" } = {}) {
    const safeProjectKey = normalizeText(projectKey) || "sg";

    if (!isUserProjectKey(safeProjectKey)) {
      return {
        ok: true,
        skipped: true,
        reason: "not_user_project_memory",
      };
    }

    const validation = await this.userProjectValidator.validateUserProjectCandidateWrite({
      actor,
      projectKey: safeProjectKey,
    });

    if (!validation.ok || !validation.allowed) {
      return {
        ok: false,
        skipped: false,
        reason: validation.reason || "user_project_memory_candidate_guard_failed",
        validation,
      };
    }

    return {
      ok: true,
      skipped: false,
      reason: null,
      validation,
    };
  }

  async prepareCandidateForConfirmation({ input = {}, createdBy = "system", projectKey = "sg", traceId = null, actor = {} } = {}) {
    const actorRef = normalizeText(createdBy) || "system";
    const safeProjectKey = normalizeText(projectKey) || "sg";
    const candidate = this.service.buildCandidate(input);

    if (!candidate.ok || !candidate.validation?.ok) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
        decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_REJECTED,
        reason: "candidate_validation_failed",
        candidate,
        errors: candidate.errors || candidate.validation?.errors || [],
        warnings: candidate.warnings || [],
        stored: false,
      };
    }

    const guard = await this.validateUserProjectCandidateGuard({
      actor,
      projectKey: safeProjectKey,
    });

    if (!guard.ok) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
        decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_REJECTED,
        reason: guard.reason,
        candidate,
        guard,
        errors: [
          createError(
            "user_project_memory_candidate_guard_failed",
            "User project Project Memory candidate was rejected before storage by the user project validation guard.",
            { reason: guard.reason },
          ),
        ],
        warnings: candidate.warnings || [],
        stored: false,
      };
    }

    const result = await this.store.createCandidate({
      item: candidate.item,
      createdBy: actorRef,
      projectKey: safeProjectKey,
      ...(traceId ? { traceId: normalizeText(traceId) } : {}),
    });

    if (!result.ok) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
        decision: "candidate_storage_failed",
        reason: result.reason || "store_create_candidate_failed",
        candidate,
        storage: result,
        stored: false,
      };
    }

    return {
      ok: true,
      mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
      decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.CANDIDATE_CREATED,
      candidate,
      entry: result.entry,
      traceId: result.traceId || traceId || null,
      stored: true,
      requiresConfirmation: result.entry?.trust !== PROJECT_MEMORY_TRUST.CONFIRMED,
      duplicateGuard: result.duplicateGuard || null,
      guard,
    };
  }

  async confirmCandidate({ entryId, confirmedBy = "system", traceId = null, approvalRef = null } = {}) {
    const safeEntryId = normalizeText(entryId);
    const actorRef = normalizeText(confirmedBy) || "system";

    if (!safeEntryId) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
        decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.NOT_CONFIRMED,
        reason: "missing_entry_id",
        errors: [createError("missing_entry_id", "Project Memory candidate entryId is required for confirmation.")],
      };
    }

    const result = await this.store.confirmCandidate({
      entryId: safeEntryId,
      confirmedBy: actorRef,
      ...(traceId ? { traceId: normalizeText(traceId) } : {}),
    });

    if (!result.ok) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
        decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.NOT_CONFIRMED,
        reason: result.reason || "store_confirm_candidate_failed",
        storage: result,
        traceId: result.traceId || traceId || null,
      };
    }

    return {
      ok: true,
      mode: PROJECT_MEMORY_CONFIRMATION_MODES.EXPLICIT_ONLY,
      decision: PROJECT_MEMORY_CONFIRMATION_DECISIONS.CONFIRMED,
      entry: result.entry,
      traceId: result.traceId || traceId || null,
      approvalRef: approvalRef ? normalizeText(approvalRef) : null,
      trust: result.entry?.trust || PROJECT_MEMORY_TRUST.CONFIRMED,
    };
  }

  async listConfirmedEntries({ projectKey = "sg", limit = 20 } = {}) {
    return this.store.listEntries({
      projectKey: normalizeText(projectKey) || "sg",
      trust: PROJECT_MEMORY_TRUST.CONFIRMED,
      status: "active",
      limit,
    });
  }
}

export default ProjectMemoryConfirmation;
