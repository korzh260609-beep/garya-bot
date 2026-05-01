// src/core/living-sg/LivingSourceProofBoundary.js
// ============================================================================
// LIVING SG — Source Proof Boundary Skeleton
//
// Purpose:
// - distinguish requested source facts from verified source facts;
// - prevent skeleton metadata from becoming proof;
// - require explicit runtime source result before verified repo/source claims;
// - keep repo-read runtime disconnected until explicitly approved.
//
// Hard boundaries:
// - no source calls here;
// - no repository reads here;
// - no repository writes here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

export const LIVING_SOURCE_PROOF_KIND = Object.freeze({
  REPO: "repo",
  RUNTIME: "runtime",
  MEMORY: "memory",
  EXTERNAL: "external",
  UNKNOWN: "unknown",
});

export const LIVING_SOURCE_PROOF_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  REQUESTED_NOT_VERIFIED: "requested_not_verified",
  VERIFIED: "verified",
  BLOCKED: "blocked",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

function normalizeKind(value) {
  const v = safeText(value);

  if (v === LIVING_SOURCE_PROOF_KIND.REPO) return LIVING_SOURCE_PROOF_KIND.REPO;
  if (v === LIVING_SOURCE_PROOF_KIND.RUNTIME) return LIVING_SOURCE_PROOF_KIND.RUNTIME;
  if (v === LIVING_SOURCE_PROOF_KIND.MEMORY) return LIVING_SOURCE_PROOF_KIND.MEMORY;
  if (v === LIVING_SOURCE_PROOF_KIND.EXTERNAL) return LIVING_SOURCE_PROOF_KIND.EXTERNAL;

  return LIVING_SOURCE_PROOF_KIND.UNKNOWN;
}

export function createLivingSourceProofBoundary(input = {}) {
  const requested = safeBool(input.requested);
  const sourceResultConfirmed = safeBool(input.sourceResultConfirmed);
  const hasSourcePayload = input.sourcePayload !== null && input.sourcePayload !== undefined;
  const kind = normalizeKind(input.kind);

  if (!requested) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingSourceProofBoundary",
      kind,
      status: LIVING_SOURCE_PROOF_STATUS.NOT_REQUESTED,
      requested: false,
      verified: false,
      canClaimVerifiedFacts: false,
      requiresSourceResult: false,
      reason: "source_not_requested",
      metadata: {
        noSourceCall: true,
        noRuntimeRepoRead: true,
        noRuntimeRepoWrite: true,
        noExecutor: true,
        noRepoStateAgentRuntime: true,
        noTechnicalModeExpansion: true,
        noSlashCommandsAdded: true,
      },
    };
  }

  if (!sourceResultConfirmed || !hasSourcePayload) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingSourceProofBoundary",
      kind,
      status: LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED,
      requested: true,
      verified: false,
      canClaimVerifiedFacts: false,
      requiresSourceResult: true,
      reason: "source_requested_but_not_verified",
      metadata: {
        noSourceCall: true,
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
    source: "LivingSourceProofBoundary",
    kind,
    status: LIVING_SOURCE_PROOF_STATUS.VERIFIED,
    requested: true,
    verified: true,
    canClaimVerifiedFacts: true,
    requiresSourceResult: false,
    reason: "source_result_confirmed_with_payload",
    metadata: {
      noSourceCall: true,
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
  LIVING_SOURCE_PROOF_KIND,
  LIVING_SOURCE_PROOF_STATUS,
  createLivingSourceProofBoundary,
};
