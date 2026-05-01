// src/core/living-sg/LivingSourceResultEnvelope.js
// ============================================================================
// LIVING SG — Source Result Envelope Skeleton
//
// Purpose:
// - define an explicit envelope for future runtime-provided source results;
// - keep sourceResult separate from planner metadata;
// - require explicit confirmation before verified source/repo claims;
// - represent freshness, target, payload and confirmation status;
// - keep repository writes blocked.
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

export const LIVING_SOURCE_RESULT_KIND = Object.freeze({
  REPO: "repo",
  RUNTIME: "runtime",
  MEMORY: "memory",
  EXTERNAL: "external",
  UNKNOWN: "unknown",
});

export const LIVING_SOURCE_RESULT_CONFIRMATION_STATUS = Object.freeze({
  MISSING: "missing",
  INVALID: "invalid",
  STALE: "stale",
  UNCONFIRMED: "unconfirmed",
  CONFIRMED: "confirmed",
});

export const LIVING_SOURCE_RESULT_FRESHNESS_STATUS = Object.freeze({
  UNKNOWN: "unknown",
  FRESH: "fresh",
  STALE: "stale",
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

function normalizeKind(value) {
  const v = safeText(value);

  if (v === LIVING_SOURCE_RESULT_KIND.REPO) return LIVING_SOURCE_RESULT_KIND.REPO;
  if (v === LIVING_SOURCE_RESULT_KIND.RUNTIME) return LIVING_SOURCE_RESULT_KIND.RUNTIME;
  if (v === LIVING_SOURCE_RESULT_KIND.MEMORY) return LIVING_SOURCE_RESULT_KIND.MEMORY;
  if (v === LIVING_SOURCE_RESULT_KIND.EXTERNAL) return LIVING_SOURCE_RESULT_KIND.EXTERNAL;

  return LIVING_SOURCE_RESULT_KIND.UNKNOWN;
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

function normalizePayload(value) {
  if (value === null || value === undefined) return null;
  return value;
}

function hasPayload(value) {
  return value !== null && value !== undefined;
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

  const text = safeText(value);

  return {
    repository: "",
    ref: "",
    path: text,
    scope: "",
    raw: text,
  };
}

function resolveConfirmationStatus({ confirmed, valid, freshnessStatus, payload }) {
  if (!hasPayload(payload)) {
    return LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.MISSING;
  }

  if (!valid) {
    return LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.INVALID;
  }

  if (freshnessStatus === LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE) {
    return LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.STALE;
  }

  if (!confirmed) {
    return LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.UNCONFIRMED;
  }

  return LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED;
}

export function createLivingSourceResultEnvelope(input = {}) {
  const kind = normalizeKind(input.kind);
  const target = normalizeTarget(input.target);
  const payload = normalizePayload(input.payload);
  const valid = input.valid === undefined ? hasPayload(payload) : safeBool(input.valid);
  const confirmed = safeBool(input.confirmed);
  const freshnessStatus = normalizeFreshnessStatus(input.freshnessStatus);
  const confirmationStatus = resolveConfirmationStatus({
    confirmed,
    valid,
    freshnessStatus,
    payload,
  });

  const canClaimVerifiedFacts =
    confirmationStatus === LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED;

  return {
    ok: true,
    dryRun: true,
    source: "LivingSourceResultEnvelope",
    envelopeVersion: "1.0.0-skeleton",
    kind,
    target,
    freshness: {
      status: freshnessStatus,
      checkedAt: safeText(input.checkedAt),
      sourceUpdatedAt: safeText(input.sourceUpdatedAt),
      maxAgeMs: Number.isFinite(input.maxAgeMs) ? input.maxAgeMs : null,
    },
    payload,
    confirmation: {
      status: confirmationStatus,
      confirmed: canClaimVerifiedFacts,
      confirmedBy: safeText(input.confirmedBy),
      reason: safeText(input.reason),
    },
    canClaimVerifiedFacts,
    canAuthorizeWrite: false,
    canExecute: false,
    metadata: {
      separateFromPlannerMetadata: true,
      runtimeProvidedOnly: true,
      noSourceCall: true,
      noRuntimeRepoRead: true,
      noRuntimeRepoWrite: true,
      noExecutor: true,
      noRepoStateAgentRuntime: true,
      noTechnicalModeExpansion: true,
      noSlashCommandsAdded: true,
      cannotAuthorizeWrites: true,
    },
  };
}

export default {
  LIVING_SOURCE_RESULT_KIND,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  createLivingSourceResultEnvelope,
};
