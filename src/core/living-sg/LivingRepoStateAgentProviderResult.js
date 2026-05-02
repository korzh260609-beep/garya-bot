// src/core/living-sg/LivingRepoStateAgentProviderResult.js
// ============================================================================
// LIVING SG — RepoStateAgent Provider Result Adapter
//
// Purpose:
// - adapt an already-obtained RepoStateAgent fastReadOnly result into a Living
//   repo providerResult shape;
// - keep RepoStateAgent execution separate from Living SG proof adaptation;
// - expose projectMap/semanticMap/nextActionPlan/architectureHealth as read-only
//   payload for the existing LivingRepoSourceProviderResultAdapter;
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
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
} from "./LivingSourceResultEnvelope.js";
import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "./LivingRepoSourceProviderBoundary.js";

export const LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS = Object.freeze({
  MISSING_RESULT: "missing_result",
  INVALID_RESULT: "invalid_result",
  STALE_OR_UNVERIFIED: "stale_or_unverified",
  ADAPTED: "adapted",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasProjectMap(value) {
  return isPlainObject(value?.projectMap);
}

function normalizeFreshness(repoStateAgentResult = {}) {
  const freshness = repoStateAgentResult?.aiMeta?.freshness || {};
  const ok = freshness?.ok === true;

  return {
    ok,
    checked: freshness?.checked === true,
    reason: safeText(freshness?.reason),
    cachedCommitSha: safeText(freshness?.cachedCommitSha),
    currentHeadCommitSha: safeText(freshness?.currentHeadCommitSha),
    headReadError: safeText(freshness?.headReadError),
  };
}

function buildTarget(repoStateAgentResult = {}, input = {}) {
  return {
    repository: safeText(
      input.repository ||
      repoStateAgentResult.repoFullName ||
      repoStateAgentResult.projectMap?.repo?.fullName
    ),
    ref: safeText(
      input.ref ||
      repoStateAgentResult.branch ||
      repoStateAgentResult.projectMap?.repo?.branch
    ),
    path: safeText(input.path || ""),
    scope: safeText(input.scope || "repo_state_agent_project_map"),
  };
}

function buildPayload(repoStateAgentResult = {}) {
  const projectMap = repoStateAgentResult.projectMap;

  return {
    provider: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
    source: safeText(repoStateAgentResult.source) || "repo_state_agent_fast_read_only",
    fastReadOnly: repoStateAgentResult.fastReadOnly === true,
    repoFullName: safeText(repoStateAgentResult.repoFullName || projectMap?.repo?.fullName),
    branch: safeText(repoStateAgentResult.branch || projectMap?.repo?.branch),
    projectMap,
    semanticMap: projectMap?.semanticMap || null,
    nextActionPlan: repoStateAgentResult.nextActionPlan || null,
    architectureHealth: repoStateAgentResult.architectureHealth || null,
    persistence: isPlainObject(repoStateAgentResult.persistence)
      ? repoStateAgentResult.persistence
      : null,
    aiMeta: isPlainObject(repoStateAgentResult.aiMeta)
      ? repoStateAgentResult.aiMeta
      : null,
    tokensSpent: repoStateAgentResult?.aiMeta?.tokensSpent === true,
    readOnly: true,
  };
}

function buildBaseMetadata({ repoStateAgentResultObserved = false } = {}) {
  return {
    adapterOnly: true,
    repoStateAgentResultObserved,
    acceptsAlreadyObtainedResultOnly: true,
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

function buildProviderResult({
  repoStateAgentResult,
  input,
  confirmed,
  freshnessStatus,
  reason,
} = {}) {
  const target = buildTarget(repoStateAgentResult, input);

  return {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
    target,
    payload: confirmed ? buildPayload(repoStateAgentResult) : null,
    confirmed,
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus,
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: safeText(repoStateAgentResult?.projectMap?.generatedAt),
    confirmedBy: "LivingRepoStateAgentProviderResult",
    reason,
  };
}

export function adaptRepoStateAgentResultToLivingProviderResult(input = {}) {
  const repoStateAgentResult = isPlainObject(input.repoStateAgentResult)
    ? input.repoStateAgentResult
    : null;

  if (!repoStateAgentResult) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoStateAgentProviderResult",
      status: LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.MISSING_RESULT,
      providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
      providerResult: buildProviderResult({
        repoStateAgentResult: {},
        input,
        confirmed: false,
        freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
        reason: "repo_state_agent_result_missing",
      }),
      canClaimVerifiedRepoFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: "repo_state_agent_result_missing",
      metadata: buildBaseMetadata({ repoStateAgentResultObserved: false }),
    };
  }

  const freshness = normalizeFreshness(repoStateAgentResult);
  const valid = repoStateAgentResult.ok === true &&
    repoStateAgentResult.fastReadOnly === true &&
    hasProjectMap(repoStateAgentResult);

  if (!valid) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoStateAgentProviderResult",
      status: LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.INVALID_RESULT,
      providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
      providerResult: buildProviderResult({
        repoStateAgentResult,
        input,
        confirmed: false,
        freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
        reason: hasProjectMap(repoStateAgentResult)
          ? "repo_state_agent_result_invalid_contract"
          : "repo_state_agent_project_map_missing",
      }),
      canClaimVerifiedRepoFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: hasProjectMap(repoStateAgentResult)
        ? "repo_state_agent_result_invalid_contract"
        : "repo_state_agent_project_map_missing",
      freshness,
      metadata: buildBaseMetadata({ repoStateAgentResultObserved: true }),
    };
  }

  if (freshness.ok !== true) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoStateAgentProviderResult",
      status: LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.STALE_OR_UNVERIFIED,
      providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
      providerResult: buildProviderResult({
        repoStateAgentResult,
        input,
        confirmed: false,
        freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
        reason: "repo_state_agent_project_map_stale_or_unverified",
      }),
      canClaimVerifiedRepoFacts: false,
      canAuthorizeWrite: false,
      canExecute: false,
      reason: "repo_state_agent_project_map_stale_or_unverified",
      freshness,
      metadata: buildBaseMetadata({ repoStateAgentResultObserved: true }),
    };
  }

  const providerResult = buildProviderResult({
    repoStateAgentResult,
    input,
    confirmed: true,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
    reason: "repo_state_agent_fast_read_only_result_adapted",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingRepoStateAgentProviderResult",
    status: LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS.ADAPTED,
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
    providerResult,
    canClaimVerifiedRepoFacts: true,
    canAuthorizeWrite: false,
    canExecute: false,
    reason: "repo_state_agent_fast_read_only_result_adapted",
    freshness,
    metadata: buildBaseMetadata({ repoStateAgentResultObserved: true }),
  };
}

export default {
  LIVING_REPO_STATE_AGENT_PROVIDER_RESULT_STATUS,
  adaptRepoStateAgentResultToLivingProviderResult,
};
