// src/core/living-sg/LivingRepoSourceCapability.js
// ============================================================================
// LIVING SG — Repo Source Capability Skeleton
//
// Purpose:
// - define a read-only repository source capability contract for Living SG;
// - separate repo fact requests from repo writes;
// - require explicit source/tool confirmation before verified repo claims;
// - keep runtime repo-read disconnected until explicitly approved.
//
// Hard boundaries:
// - no repository reads here;
// - no repository writes here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

export const LIVING_REPO_SOURCE_CAPABILITY = Object.freeze({
  REPO_FACTS_READ: "repo_facts_read",
  REPO_STATUS_READ: "repo_status_read",
  REPO_FILE_READ: "repo_file_read",
  REPO_WRITE: "repo_write",
});

export const LIVING_REPO_SOURCE_STATUS = Object.freeze({
  SOURCE_REQUIRED: "source_required",
  SOURCE_NOT_CONNECTED: "source_not_connected",
  READ_ONLY_ALLOWED_BY_CONTRACT: "read_only_allowed_by_contract",
  WRITE_BLOCKED: "write_blocked",
});

export const LIVING_REPO_SOURCE_ACTION_TYPE = Object.freeze({
  READ_ONLY: "read_only",
  STATE_CHANGING: "state_changing",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

function normalizeRequestedCapability(value) {
  const v = safeText(value);

  if (v === LIVING_REPO_SOURCE_CAPABILITY.REPO_STATUS_READ) {
    return LIVING_REPO_SOURCE_CAPABILITY.REPO_STATUS_READ;
  }

  if (v === LIVING_REPO_SOURCE_CAPABILITY.REPO_FILE_READ) {
    return LIVING_REPO_SOURCE_CAPABILITY.REPO_FILE_READ;
  }

  if (v === LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE) {
    return LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE;
  }

  return LIVING_REPO_SOURCE_CAPABILITY.REPO_FACTS_READ;
}

export function createLivingRepoSourceCapabilityPlan(input = {}) {
  const requestedCapability = normalizeRequestedCapability(input.requestedCapability);
  const repoRuntimeConnected = safeBool(input.repoRuntimeConnected);
  const sourceResultConfirmed = safeBool(input.sourceResultConfirmed);

  const isWrite = requestedCapability === LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE;

  if (isWrite) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoSourceCapability",
      requestedCapability,
      actionType: LIVING_REPO_SOURCE_ACTION_TYPE.STATE_CHANGING,
      status: LIVING_REPO_SOURCE_STATUS.WRITE_BLOCKED,
      canReadRepo: false,
      canWriteRepo: false,
      canClaimVerifiedRepoFacts: false,
      requiresExplicitPermission: true,
      requiresRuntimeSource: true,
      requiresSourceResultConfirmation: true,
      reason: "repo_write_blocked_in_skeleton",
      metadata: {
        noRuntimeRepoRead: true,
        noRuntimeRepoWrite: true,
        noExecutor: true,
        noRepoStateAgentRuntime: true,
        noTechnicalModeExpansion: true,
        noSlashCommandsAdded: true,
      },
    };
  }

  if (!repoRuntimeConnected) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingRepoSourceCapability",
      requestedCapability,
      actionType: LIVING_REPO_SOURCE_ACTION_TYPE.READ_ONLY,
      status: LIVING_REPO_SOURCE_STATUS.SOURCE_NOT_CONNECTED,
      canReadRepo: false,
      canWriteRepo: false,
      canClaimVerifiedRepoFacts: false,
      requiresExplicitPermission: false,
      requiresRuntimeSource: true,
      requiresSourceResultConfirmation: true,
      reason: "repo_source_runtime_not_connected",
      metadata: {
        noRuntimeRepoRead: true,
        noRuntimeRepoWrite: true,
        noExecutor: true,
        noRepoStateAgentRuntime: true,
        noTechnicalModeExpansion: true,
        noSlashCommandsAdded: true,
      },
    };
  }

  return {
    ok: true,
    dryRun: true,
    source: "LivingRepoSourceCapability",
    requestedCapability,
    actionType: LIVING_REPO_SOURCE_ACTION_TYPE.READ_ONLY,
    status: sourceResultConfirmed
      ? LIVING_REPO_SOURCE_STATUS.READ_ONLY_ALLOWED_BY_CONTRACT
      : LIVING_REPO_SOURCE_STATUS.SOURCE_REQUIRED,
    canReadRepo: sourceResultConfirmed,
    canWriteRepo: false,
    canClaimVerifiedRepoFacts: sourceResultConfirmed,
    requiresExplicitPermission: false,
    requiresRuntimeSource: true,
    requiresSourceResultConfirmation: !sourceResultConfirmed,
    reason: sourceResultConfirmed
      ? "repo_source_result_confirmed_read_only"
      : "repo_source_result_required_before_verified_claims",
    metadata: {
      noRuntimeRepoRead: true,
      noRuntimeRepoWrite: true,
      noExecutor: true,
      noRepoStateAgentRuntime: true,
      noTechnicalModeExpansion: true,
      noSlashCommandsAdded: true,
    },
  };
}

export default {
  LIVING_REPO_SOURCE_CAPABILITY,
  LIVING_REPO_SOURCE_STATUS,
  LIVING_REPO_SOURCE_ACTION_TYPE,
  createLivingRepoSourceCapabilityPlan,
};
