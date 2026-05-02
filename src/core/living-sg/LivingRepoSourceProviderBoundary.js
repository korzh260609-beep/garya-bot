// src/core/living-sg/LivingRepoSourceProviderBoundary.js
// ============================================================================
// LIVING SG — Repo Source Provider Boundary Skeleton
//
// Purpose:
// - define a disconnected boundary contract for future repository source providers;
// - keep provider planning separate from repository execution;
// - describe the expected sourceResultEnvelope proof shape;
// - prevent legacy projectIntent snapshot data from becoming Living SG proof;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no repository reads here;
// - no repository writes here;
// - no source calls here;
// - no GitHub token usage here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Human Meaning Provider connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import {
  LIVING_REPO_READ_PROOF_FORMAT,
  LIVING_REPO_READ_REQUEST_KIND,
} from "./LivingRepoReadRequestPlan.js";
import {
  LIVING_SOURCE_RESULT_KIND,
} from "./LivingSourceResultEnvelope.js";

export const LIVING_REPO_SOURCE_PROVIDER_KIND = Object.freeze({
  LEGACY_SNAPSHOT_ADAPTER: "legacy_snapshot_adapter",
  GITHUB_PROVIDER: "github_provider",
  REPO_STATE_AGENT_PROVIDER: "repo_state_agent_provider",
  UNKNOWN: "unknown",
});

export const LIVING_REPO_SOURCE_PROVIDER_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  PROVIDER_REQUIRED: "provider_required",
  PROVIDER_NOT_CONNECTED: "provider_not_connected",
  WRITE_BLOCKED: "write_blocked",
});

export const LIVING_REPO_SOURCE_PROVIDER_ACTION_TYPE = Object.freeze({
  READ_ONLY: "read_only",
  STATE_CHANGING: "state_changing",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

function normalizeProviderKind(value) {
  const v = safeText(value);

  if (v === LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER) {
    return LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER;
  }

  if (v === LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER) {
    return LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER;
  }

  if (v === LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER) {
    return LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER;
  }

  return LIVING_REPO_SOURCE_PROVIDER_KIND.UNKNOWN;
}

function normalizeRequestKind(value) {
  const v = safeText(value);

  if (v === LIVING_REPO_READ_REQUEST_KIND.REPO_STATUS) {
    return LIVING_REPO_READ_REQUEST_KIND.REPO_STATUS;
  }

  if (v === LIVING_REPO_READ_REQUEST_KIND.REPO_FILE) {
    return LIVING_REPO_READ_REQUEST_KIND.REPO_FILE;
  }

  if (v === LIVING_REPO_READ_REQUEST_KIND.REPO_FACTS) {
    return LIVING_REPO_READ_REQUEST_KIND.REPO_FACTS;
  }

  return LIVING_REPO_READ_REQUEST_KIND.NONE;
}

function buildTarget(input = {}) {
  return {
    repository: safeText(input.repository),
    ref: safeText(input.ref),
    path: safeText(input.path || input.target),
    scope: safeText(input.scope || input.requestKind),
  };
}

function buildExpectedSourceResultEnvelope({ requestKind, target, providerKind } = {}) {
  return {
    format: LIVING_REPO_READ_PROOF_FORMAT.SOURCE_RESULT_ENVELOPE,
    kind: LIVING_SOURCE_RESULT_KIND.REPO,
    requestKind,
    providerKind,
    target,
    requiredFields: [
      "kind",
      "target.repository",
      "target.ref",
      "target.path",
      "target.scope",
      "freshness.status",
      "payload",
      "confirmation.status",
      "canClaimVerifiedFacts",
      "canAuthorizeWrite",
    ],
    requiredConfirmationStatus: "confirmed",
    requiresFreshnessCheck: true,
    requiresPayload: true,
    canAuthorizeWrite: false,
    canExecute: false,
    metadata: {
      providerBoundaryOnly: true,
      expectedProofOnly: true,
      notProofByItself: true,
      noSourceCall: true,
      noRuntimeRepoRead: true,
      noRuntimeRepoWrite: true,
      noGitHubTokenUsage: true,
      noExecutor: true,
      noRepoStateAgentRuntime: true,
      noHumanMeaningProvider: true,
      noTechnicalModeExpansion: true,
      noSlashCommandsAdded: true,
      cannotAuthorizeWrites: true,
    },
  };
}

function buildBaseMetadata() {
  return {
    disconnectedSkeleton: true,
    providerBoundaryOnly: true,
    expectsSourceResultEnvelope: true,
    providerPlanIsNotProof: true,
    legacySnapshotIsNotLivingProof: true,
    noSourceCall: true,
    noRuntimeRepoRead: true,
    noRuntimeRepoWrite: true,
    noGitHubTokenUsage: true,
    noExecutor: true,
    noRepoStateAgentRuntime: true,
    noHumanMeaningProvider: true,
    noTechnicalModeExpansion: true,
    noSlashCommandsAdded: true,
    cannotAuthorizeWrites: true,
  };
}

export function createLivingRepoSourceProviderBoundary(input = {}) {
  const requested = safeBool(input.requested);
  const writeRequested = safeBool(input.writeRequested);
  const providerKind = normalizeProviderKind(input.providerKind);
  const requestKind = normalizeRequestKind(input.requestKind);
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref,
    path: input.path,
    target: input.target,
    scope: input.scope,
    requestKind,
  });

  const expectedSourceResultEnvelope = buildExpectedSourceResultEnvelope({
    requestKind,
    target,
    providerKind,
  });

  if (writeRequested) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoSourceProviderBoundary",
      status: LIVING_REPO_SOURCE_PROVIDER_STATUS.WRITE_BLOCKED,
      actionType: LIVING_REPO_SOURCE_PROVIDER_ACTION_TYPE.STATE_CHANGING,
      requested: true,
      writeRequested: true,
      providerKind,
      requestKind,
      target,
      shouldRequestProvider: false,
      requiresRuntimeProvider: true,
      expectedSourceResultEnvelope,
      sourceResultEnvelope: null,
      canReadRepo: false,
      canWriteRepo: false,
      canExecute: false,
      canClaimVerifiedRepoFacts: false,
      reason: "repo_write_blocked_by_provider_boundary_skeleton",
      metadata: buildBaseMetadata(),
    };
  }

  if (!requested || requestKind === LIVING_REPO_READ_REQUEST_KIND.NONE) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingRepoSourceProviderBoundary",
      status: LIVING_REPO_SOURCE_PROVIDER_STATUS.NOT_REQUESTED,
      actionType: LIVING_REPO_SOURCE_PROVIDER_ACTION_TYPE.READ_ONLY,
      requested: false,
      writeRequested: false,
      providerKind,
      requestKind: LIVING_REPO_READ_REQUEST_KIND.NONE,
      target,
      shouldRequestProvider: false,
      requiresRuntimeProvider: false,
      expectedSourceResultEnvelope,
      sourceResultEnvelope: null,
      canReadRepo: false,
      canWriteRepo: false,
      canExecute: false,
      canClaimVerifiedRepoFacts: false,
      reason: "repo_source_provider_not_requested",
      metadata: buildBaseMetadata(),
    };
  }

  return {
    ok: true,
    dryRun: true,
    source: "LivingRepoSourceProviderBoundary",
    status: providerKind === LIVING_REPO_SOURCE_PROVIDER_KIND.UNKNOWN
      ? LIVING_REPO_SOURCE_PROVIDER_STATUS.PROVIDER_REQUIRED
      : LIVING_REPO_SOURCE_PROVIDER_STATUS.PROVIDER_NOT_CONNECTED,
    actionType: LIVING_REPO_SOURCE_PROVIDER_ACTION_TYPE.READ_ONLY,
    requested: true,
    writeRequested: false,
    providerKind,
    requestKind,
    target,
    shouldRequestProvider: true,
    requiresRuntimeProvider: true,
    expectedSourceResultEnvelope,
    sourceResultEnvelope: null,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    canClaimVerifiedRepoFacts: false,
    reason: providerKind === LIVING_REPO_SOURCE_PROVIDER_KIND.UNKNOWN
      ? "repo_source_provider_required_but_not_selected"
      : "repo_source_provider_selected_but_not_connected",
    metadata: buildBaseMetadata(),
  };
}

export default {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
  LIVING_REPO_SOURCE_PROVIDER_STATUS,
  LIVING_REPO_SOURCE_PROVIDER_ACTION_TYPE,
  createLivingRepoSourceProviderBoundary,
};
