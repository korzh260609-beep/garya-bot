// src/core/living-sg/LivingRepoSourceProviderResultAdapter.js
// ============================================================================
// LIVING SG — Repo Source Provider Result Adapter Skeleton
//
// Purpose:
// - adapt an already-provided repo provider result into sourceResultEnvelope;
// - validate that provider output is explicit, read-only and payload-bearing;
// - keep provider execution separate from proof adaptation;
// - prevent provider plans / expected envelopes / legacy snapshots from becoming
//   proof without an explicit providerResult;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no repository reads here;
// - no repository writes here;
// - no source calls here;
// - no provider calls here;
// - no GitHub token usage here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Human Meaning Provider connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import {
  createLivingSourceResultEnvelope,
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
} from "./LivingSourceResultEnvelope.js";
import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "./LivingRepoSourceProviderBoundary.js";

export const LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS = Object.freeze({
  MISSING_PROVIDER_RESULT: "missing_provider_result",
  INVALID_PROVIDER_RESULT: "invalid_provider_result",
  ADAPTED_TO_ENVELOPE: "adapted_to_envelope",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function normalizeFreshnessStatus(value) {
  const v = safeText(value);

  if (v === LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH) {
    return LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH;
  }

  if (v === LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE) {
    return LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE;
  }

  return LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN;
}

function normalizeTarget(value) {
  if (isPlainObject(value)) {
    return {
      repository: safeText(value.repository),
      ref: safeText(value.ref),
      path: safeText(value.path),
      scope: safeText(value.scope),
      raw: value,
    };
  }

  return {
    repository: "",
    ref: "",
    path: safeText(value),
    scope: "",
    raw: value ?? "",
  };
}

function hasPayload(value) {
  return value !== null && value !== undefined;
}

function buildBaseMetadata({ providerKind, providerResultObserved = false } = {}) {
  return {
    adapterSkeletonOnly: true,
    providerKind,
    providerResultObserved,
    providerResultRequired: true,
    providerPlanIsNotProof: true,
    expectedSourceResultEnvelopeIsNotProof: true,
    legacySnapshotIsNotLivingProofByItself: true,
    noSourceCall: true,
    noProviderCall: true,
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

function buildInvalidEnvelope({ providerKind, target, reason }) {
  return createLivingSourceResultEnvelope({
    kind: LIVING_SOURCE_RESULT_KIND.REPO,
    target,
    payload: null,
    valid: false,
    confirmed: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
    checkedAt: "",
    sourceUpdatedAt: "",
    confirmedBy: "LivingRepoSourceProviderResultAdapter",
    reason,
  });
}

export function adaptLivingRepoSourceProviderResult(input = {}) {
  const providerResult = isPlainObject(input.providerResult)
    ? input.providerResult
    : null;

  const providerKind = normalizeProviderKind(
    input.providerKind || providerResult?.providerKind
  );

  if (!providerResult) {
    const target = normalizeTarget(input.target || {});
    const sourceResultEnvelope = buildInvalidEnvelope({
      providerKind,
      target,
      reason: "missing_provider_result",
    });

    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoSourceProviderResultAdapter",
      status: LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.MISSING_PROVIDER_RESULT,
      providerKind,
      sourceResultEnvelope,
      canClaimVerifiedRepoFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: "missing_provider_result",
      metadata: buildBaseMetadata({ providerKind, providerResultObserved: false }),
    };
  }

  const target = normalizeTarget(providerResult.target || input.target || {});
  const payload = providerResult.payload;
  const providerConfirmed = safeBool(providerResult.confirmed);
  const providerReadOnly = providerResult.readOnly !== false;
  const providerWriteAuthorized = safeBool(providerResult.canAuthorizeWrite);
  const providerExecutable = safeBool(providerResult.canExecute);
  const freshnessStatus = normalizeFreshnessStatus(providerResult.freshnessStatus);
  const valid =
    hasPayload(payload) &&
    providerReadOnly === true &&
    providerWriteAuthorized === false &&
    providerExecutable === false;

  if (!valid) {
    const sourceResultEnvelope = buildInvalidEnvelope({
      providerKind,
      target,
      reason: hasPayload(payload)
        ? "invalid_provider_result_contract"
        : "missing_provider_payload",
    });

    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoSourceProviderResultAdapter",
      status: LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.INVALID_PROVIDER_RESULT,
      providerKind,
      providerResult,
      sourceResultEnvelope,
      canClaimVerifiedRepoFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: sourceResultEnvelope.confirmation.reason,
      metadata: buildBaseMetadata({ providerKind, providerResultObserved: true }),
    };
  }

  const sourceResultEnvelope = createLivingSourceResultEnvelope({
    kind: LIVING_SOURCE_RESULT_KIND.REPO,
    target,
    payload,
    valid: true,
    confirmed: providerConfirmed,
    freshnessStatus,
    checkedAt: safeText(providerResult.checkedAt),
    sourceUpdatedAt: safeText(providerResult.sourceUpdatedAt),
    maxAgeMs: Number.isFinite(providerResult.maxAgeMs) ? providerResult.maxAgeMs : null,
    confirmedBy: safeText(providerResult.confirmedBy) || "LivingRepoSourceProviderResultAdapter",
    reason: safeText(providerResult.reason) || "provider_result_adapted",
  });

  return {
    ok: sourceResultEnvelope.canClaimVerifiedFacts === true,
    dryRun: true,
    source: "LivingRepoSourceProviderResultAdapter",
    status: LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.ADAPTED_TO_ENVELOPE,
    providerKind,
    providerResult,
    sourceResultEnvelope,
    canClaimVerifiedRepoFacts: sourceResultEnvelope.canClaimVerifiedFacts === true,
    canAuthorizeWrite: false,
    canExecute: false,
    reason: sourceResultEnvelope.canClaimVerifiedFacts === true
      ? "provider_result_confirmed_and_adapted"
      : "provider_result_adapted_but_not_confirmed",
    metadata: buildBaseMetadata({ providerKind, providerResultObserved: true }),
  };
}

export default {
  LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS,
  adaptLivingRepoSourceProviderResult,
};
