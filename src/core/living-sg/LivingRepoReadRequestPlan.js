// src/core/living-sg/LivingRepoReadRequestPlan.js
// ============================================================================
// LIVING SG — Repo Read Request Planner Skeleton
//
// Purpose:
// - represent a future read-only request for repository facts;
// - keep planning separate from repository execution;
// - require source proof before verified repo claims;
// - declare sourceResult envelope as the expected proof format;
// - keep repository writes blocked.
//
// Hard boundaries:
// - no repository reads here;
// - no repository writes here;
// - no source calls here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import {
  LIVING_REPO_SOURCE_CAPABILITY,
  createLivingRepoSourceCapabilityPlan,
} from "./LivingRepoSourceCapability.js";
import {
  LIVING_SOURCE_PROOF_KIND,
  createLivingSourceProofBoundary,
} from "./LivingSourceProofBoundary.js";
import {
  LIVING_SOURCE_RESULT_KIND,
} from "./LivingSourceResultEnvelope.js";

export const LIVING_REPO_READ_REQUEST_KIND = Object.freeze({
  REPO_FACTS: "repo_facts",
  REPO_STATUS: "repo_status",
  REPO_FILE: "repo_file",
  NONE: "none",
});

export const LIVING_REPO_READ_REQUEST_STATUS = Object.freeze({
  NOT_NEEDED: "not_needed",
  PLANNED_SOURCE_REQUIRED: "planned_source_required",
  BLOCKED_WRITE_REQUEST: "blocked_write_request",
});

export const LIVING_REPO_READ_PROOF_FORMAT = Object.freeze({
  SOURCE_RESULT_ENVELOPE: "source_result_envelope",
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

function capabilityForRequestKind(kind) {
  if (kind === LIVING_REPO_READ_REQUEST_KIND.REPO_STATUS) {
    return LIVING_REPO_SOURCE_CAPABILITY.REPO_STATUS_READ;
  }

  if (kind === LIVING_REPO_READ_REQUEST_KIND.REPO_FILE) {
    return LIVING_REPO_SOURCE_CAPABILITY.REPO_FILE_READ;
  }

  return LIVING_REPO_SOURCE_CAPABILITY.REPO_FACTS_READ;
}

function buildExpectedSourceResultEnvelope({ requestKind, target } = {}) {
  return {
    format: LIVING_REPO_READ_PROOF_FORMAT.SOURCE_RESULT_ENVELOPE,
    kind: LIVING_SOURCE_RESULT_KIND.REPO,
    requestKind,
    target,
    requiredFields: [
      "kind",
      "target",
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
      planningOnly: true,
      noSourceCall: true,
      noRuntimeRepoRead: true,
      noRuntimeRepoWrite: true,
      noExecutor: true,
      cannotAuthorizeWrites: true,
    },
  };
}

function getProvidedEnvelope(input = {}) {
  if (isPlainObject(input.sourceResultEnvelope)) return input.sourceResultEnvelope;
  if (isPlainObject(input.sourceResult)) return input.sourceResult;
  return null;
}

function buildBaseMetadata() {
  return {
    expectsSourceResultEnvelope: true,
    noRuntimeRepoRead: true,
    noRuntimeRepoWrite: true,
    noSourceCall: true,
    noExecutor: true,
    noRepoStateAgentRuntime: true,
    noTechnicalModeExpansion: true,
    noSlashCommandsAdded: true,
    cannotAuthorizeWrites: true,
  };
}

export function createLivingRepoReadRequestPlan(input = {}) {
  const requested = safeBool(input.requested);
  const writeRequested = safeBool(input.writeRequested);
  const requestKind = normalizeRequestKind(input.requestKind);
  const target = safeText(input.target);
  const sourceResultEnvelope = getProvidedEnvelope(input);
  const expectedSourceResultEnvelope = buildExpectedSourceResultEnvelope({
    requestKind,
    target,
  });

  if (writeRequested) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingRepoReadRequestPlan",
      status: LIVING_REPO_READ_REQUEST_STATUS.BLOCKED_WRITE_REQUEST,
      requestKind,
      target,
      requested: true,
      writeRequested: true,
      shouldRequestSource: false,
      expectedSourceResultEnvelope,
      sourceResultEnvelope,
      canReadRepo: false,
      canWriteRepo: false,
      canClaimVerifiedRepoFacts: false,
      requiresSourceProof: true,
      reason: "repo_write_request_blocked_by_read_planner",
      capabilityPlan: createLivingRepoSourceCapabilityPlan({
        requestedCapability: LIVING_REPO_SOURCE_CAPABILITY.REPO_WRITE,
        repoRuntimeConnected: false,
        sourceResultConfirmed: false,
      }),
      sourceProof: createLivingSourceProofBoundary({
        kind: LIVING_SOURCE_PROOF_KIND.REPO,
        requested: true,
        sourceResultEnvelope,
        sourceResultConfirmed: false,
        sourcePayload: null,
      }),
      metadata: buildBaseMetadata(),
    };
  }

  if (!requested || requestKind === LIVING_REPO_READ_REQUEST_KIND.NONE) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingRepoReadRequestPlan",
      status: LIVING_REPO_READ_REQUEST_STATUS.NOT_NEEDED,
      requestKind: LIVING_REPO_READ_REQUEST_KIND.NONE,
      target: "",
      requested: false,
      writeRequested: false,
      shouldRequestSource: false,
      expectedSourceResultEnvelope,
      sourceResultEnvelope,
      canReadRepo: false,
      canWriteRepo: false,
      canClaimVerifiedRepoFacts: false,
      requiresSourceProof: false,
      reason: "repo_read_not_needed",
      capabilityPlan: null,
      sourceProof: createLivingSourceProofBoundary({
        kind: LIVING_SOURCE_PROOF_KIND.REPO,
        requested: false,
        sourceResultEnvelope,
        sourceResultConfirmed: false,
        sourcePayload: null,
      }),
      metadata: buildBaseMetadata(),
    };
  }

  const capabilityPlan = createLivingRepoSourceCapabilityPlan({
    requestedCapability: capabilityForRequestKind(requestKind),
    repoRuntimeConnected: false,
    sourceResultConfirmed: false,
  });

  const sourceProof = createLivingSourceProofBoundary({
    kind: LIVING_SOURCE_PROOF_KIND.REPO,
    requested: true,
    sourceResultEnvelope,
    sourceResultConfirmed: false,
    sourcePayload: null,
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingRepoReadRequestPlan",
    status: LIVING_REPO_READ_REQUEST_STATUS.PLANNED_SOURCE_REQUIRED,
    requestKind,
    target,
    requested: true,
    writeRequested: false,
    shouldRequestSource: true,
    expectedSourceResultEnvelope,
    sourceResultEnvelope,
    canReadRepo: false,
    canWriteRepo: false,
    canClaimVerifiedRepoFacts: sourceProof?.canClaimVerifiedFacts === true,
    requiresSourceProof: true,
    reason: sourceProof?.canClaimVerifiedFacts === true
      ? "repo_read_planned_with_confirmed_source_result_envelope"
      : "repo_read_planned_but_source_required",
    capabilityPlan,
    sourceProof,
    metadata: buildBaseMetadata(),
  };
}

export default {
  LIVING_REPO_READ_REQUEST_KIND,
  LIVING_REPO_READ_REQUEST_STATUS,
  LIVING_REPO_READ_PROOF_FORMAT,
  createLivingRepoReadRequestPlan,
};
