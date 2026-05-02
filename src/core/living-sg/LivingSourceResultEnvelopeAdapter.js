// src/core/living-sg/LivingSourceResultEnvelopeAdapter.js
// ============================================================================
// LIVING SG — Source Result Envelope Adapter Skeleton
//
// Purpose:
// - adapt an already-existing legacy sourceCtx/sourceResult into a Living SG
//   Source Result Envelope;
// - keep legacy source result conversion separate from source execution;
// - allow future promptAssembly input to receive explicit envelope evidence;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no source calls here;
// - no repository reads here;
// - no repository writes here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Human Meaning Provider connection;
// - no Technical Mode expansion;
// - no slash-command dependency;
// - no runtime wiring yet.
// ============================================================================

import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "./LivingSourceResultEnvelope.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasContent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getLegacySourceResult(input = {}) {
  if (isPlainObject(input.sourceResult)) return input.sourceResult;
  if (isPlainObject(input.sourceCtx?.sourceResult)) return input.sourceCtx.sourceResult;
  return null;
}

function resolveKind(sourceResult = null) {
  const sourceKey = safeText(sourceResult?.sourceKey).toLowerCase();

  if (sourceKey.includes("repo") || sourceKey.includes("github")) {
    return LIVING_SOURCE_RESULT_KIND.REPO;
  }

  if (sourceKey.includes("memory")) {
    return LIVING_SOURCE_RESULT_KIND.MEMORY;
  }

  if (sourceKey) {
    return LIVING_SOURCE_RESULT_KIND.EXTERNAL;
  }

  return LIVING_SOURCE_RESULT_KIND.UNKNOWN;
}

function buildTarget({ sourceResult = null, sourceCtx = null } = {}) {
  return {
    repository: safeText(sourceResult?.meta?.repository || sourceCtx?.repo || ""),
    ref: safeText(sourceResult?.meta?.ref || sourceCtx?.ref || ""),
    path: safeText(sourceResult?.meta?.path || sourceResult?.sourceKey || ""),
    scope: safeText(sourceResult?.meta?.scope || sourceCtx?.sourcePlan?.decision || "legacy_source_result"),
  };
}

function buildPayload(sourceResult = null) {
  if (!isPlainObject(sourceResult)) return null;

  return {
    sourceKey: safeText(sourceResult.sourceKey),
    content: safeText(sourceResult.content),
    fetchedAt: safeText(sourceResult.fetchedAt),
    meta: isPlainObject(sourceResult.meta) ? sourceResult.meta : {},
    legacySourceResult: true,
  };
}

export function adaptLegacySourceResultToEnvelope(input = {}) {
  const sourceCtx = isPlainObject(input.sourceCtx) ? input.sourceCtx : null;
  const sourceResult = getLegacySourceResult(input);

  if (!isPlainObject(sourceResult)) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingSourceResultEnvelopeAdapter",
      sourceResultEnvelope: null,
      reason: "legacy_source_result_missing",
      metadata: {
        adapterOnly: true,
        noSourceCall: true,
        noRuntimeRepoRead: true,
        noRuntimeRepoWrite: true,
        noExecutor: true,
        noRepoStateAgentRuntime: true,
        noHumanMeaningProvider: true,
        noTechnicalModeExpansion: true,
        noSlashCommandsAdded: true,
        noRuntimeWiring: true,
        cannotAuthorizeWrites: true,
      },
    };
  }

  const valid = sourceResult.ok === true && hasContent(sourceResult.content);

  if (!valid) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingSourceResultEnvelopeAdapter",
      sourceResultEnvelope: createLivingSourceResultEnvelope({
        kind: resolveKind(sourceResult),
        target: buildTarget({ sourceResult, sourceCtx }),
        freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
        checkedAt: safeText(sourceResult.fetchedAt),
        sourceUpdatedAt: safeText(sourceResult.fetchedAt),
        payload: null,
        valid: false,
        confirmed: false,
        confirmedBy: "legacy-source-result-adapter",
        reason: "legacy_source_result_invalid_or_empty",
      }),
      reason: "legacy_source_result_invalid_or_empty",
      metadata: {
        adapterOnly: true,
        noSourceCall: true,
        noRuntimeRepoRead: true,
        noRuntimeRepoWrite: true,
        noExecutor: true,
        noRepoStateAgentRuntime: true,
        noHumanMeaningProvider: true,
        noTechnicalModeExpansion: true,
        noSlashCommandsAdded: true,
        noRuntimeWiring: true,
        cannotAuthorizeWrites: true,
      },
    };
  }

  const envelope = createLivingSourceResultEnvelope({
    kind: resolveKind(sourceResult),
    target: buildTarget({ sourceResult, sourceCtx }),
    freshnessStatus: sourceResult.fetchedAt
      ? LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH
      : LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
    checkedAt: safeText(sourceResult.fetchedAt),
    sourceUpdatedAt: safeText(sourceResult.fetchedAt),
    payload: buildPayload(sourceResult),
    valid: true,
    confirmed: true,
    confirmedBy: "legacy-source-result-adapter",
    reason: "legacy_source_result_adapted_from_existing_runtime_result",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingSourceResultEnvelopeAdapter",
    sourceResultEnvelope: envelope,
    reason: "legacy_source_result_adapted",
    metadata: {
      adapterOnly: true,
      sourceResultAlreadyExisted: true,
      noSourceCall: true,
      noRuntimeRepoRead: true,
      noRuntimeRepoWrite: true,
      noExecutor: true,
      noRepoStateAgentRuntime: true,
      noHumanMeaningProvider: true,
      noTechnicalModeExpansion: true,
      noSlashCommandsAdded: true,
      noRuntimeWiring: true,
      cannotAuthorizeWrites: true,
    },
  };
}

export default {
  adaptLegacySourceResultToEnvelope,
};
