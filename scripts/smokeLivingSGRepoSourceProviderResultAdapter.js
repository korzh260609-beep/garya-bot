// scripts/smokeLivingSGRepoSourceProviderResultAdapter.js
// ============================================================================
// Smoke — Living SG Repo Source Provider Result Adapter
//
// Contract smoke for disconnected provider result adapter skeleton.
//
// Boundaries:
// - no repository reads;
// - no repository writes;
// - no source calls;
// - no provider calls;
// - no GitHub token usage;
// - no executor;
// - no RepoStateAgent runtime;
// - no Human Meaning Provider;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import assert from "node:assert/strict";

import {
  adaptLivingRepoSourceProviderResult,
  LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS,
} from "../src/core/living-sg/LivingRepoSourceProviderResultAdapter.js";
import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "../src/core/living-sg/LivingRepoSourceProviderBoundary.js";
import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

function assertHardBoundaries(result) {
  assert.equal(result.dryRun, true);
  assert.equal(result.canAuthorizeWrite, false);
  assert.equal(result.canExecute, false);
  assert.equal(result.metadata.noSourceCall, true);
  assert.equal(result.metadata.noProviderCall, true);
  assert.equal(result.metadata.noRuntimeRepoRead, true);
  assert.equal(result.metadata.noRuntimeRepoWrite, true);
  assert.equal(result.metadata.noGitHubTokenUsage, true);
  assert.equal(result.metadata.noExecutor, true);
  assert.equal(result.metadata.noRepoStateAgentRuntime, true);
  assert.equal(result.metadata.noHumanMeaningProvider, true);
  assert.equal(result.metadata.noTechnicalModeExpansion, true);
  assert.equal(result.metadata.noSlashCommandsAdded, true);
  assert.equal(result.metadata.cannotAuthorizeWrites, true);
  assert.equal(result.sourceResultEnvelope.canAuthorizeWrite, false);
  assert.equal(result.sourceResultEnvelope.canExecute, false);
}

const missing = adaptLivingRepoSourceProviderResult({
  providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    path: "src/core/living-sg/LivingRepoSourceProviderBoundary.js",
    scope: "repo_file",
  },
});

assert.equal(missing.ok, false);
assert.equal(missing.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.MISSING_PROVIDER_RESULT);
assert.equal(missing.canClaimVerifiedRepoFacts, false);
assert.equal(missing.sourceResultEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(missing.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.MISSING);
assertHardBoundaries(missing);

const invalidMissingPayload = adaptLivingRepoSourceProviderResult({
  providerResult: {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER,
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "package.json",
      scope: "repo_file",
    },
    payload: null,
    confirmed: true,
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  },
});

assert.equal(invalidMissingPayload.ok, false);
assert.equal(invalidMissingPayload.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.INVALID_PROVIDER_RESULT);
assert.equal(invalidMissingPayload.canClaimVerifiedRepoFacts, false);
assert.equal(invalidMissingPayload.reason, "missing_provider_payload");
assert.equal(invalidMissingPayload.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.MISSING);
assertHardBoundaries(invalidMissingPayload);

const invalidWriteCapability = adaptLivingRepoSourceProviderResult({
  providerResult: {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER,
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "package.json",
      scope: "repo_file",
    },
    payload: { text: "{}" },
    confirmed: true,
    readOnly: true,
    canAuthorizeWrite: true,
    canExecute: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  },
});

assert.equal(invalidWriteCapability.ok, false);
assert.equal(invalidWriteCapability.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.INVALID_PROVIDER_RESULT);
assert.equal(invalidWriteCapability.canClaimVerifiedRepoFacts, false);
assert.equal(invalidWriteCapability.reason, "invalid_provider_result_contract");
assert.equal(invalidWriteCapability.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.INVALID);
assertHardBoundaries(invalidWriteCapability);

const confirmed = adaptLivingRepoSourceProviderResult({
  providerResult: {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER,
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "src/core/handleMessage/legacyProjectIntentFlow.js",
      scope: "repo_file",
    },
    payload: {
      text: "verified provider result payload",
      sha: "abc123",
    },
    confirmed: true,
    confirmedBy: "smoke-test",
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
    checkedAt: "2026-05-02T08:45:00+03:00",
    sourceUpdatedAt: "2026-05-02T08:40:00+03:00",
    maxAgeMs: 60000,
    reason: "confirmed_provider_payload",
  },
});

assert.equal(confirmed.ok, true);
assert.equal(confirmed.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.ADAPTED_TO_ENVELOPE);
assert.equal(confirmed.canClaimVerifiedRepoFacts, true);
assert.equal(confirmed.sourceResultEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(confirmed.sourceResultEnvelope.canClaimVerifiedFacts, true);
assert.equal(confirmed.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED);
assert.equal(confirmed.sourceResultEnvelope.confirmation.confirmedBy, "smoke-test");
assert.equal(confirmed.sourceResultEnvelope.target.repository, "korzh260609-beep/garya-bot");
assert.equal(confirmed.sourceResultEnvelope.target.ref, "main");
assert.equal(confirmed.sourceResultEnvelope.target.path, "src/core/handleMessage/legacyProjectIntentFlow.js");
assert.equal(confirmed.sourceResultEnvelope.target.scope, "repo_file");
assert.equal(confirmed.sourceResultEnvelope.payload.text, "verified provider result payload");
assertHardBoundaries(confirmed);

const unconfirmed = adaptLivingRepoSourceProviderResult({
  providerResult: {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.REPO_STATE_AGENT_PROVIDER,
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "README.md",
      scope: "repo_file",
    },
    payload: { text: "available but not confirmed" },
    confirmed: false,
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  },
});

assert.equal(unconfirmed.ok, false);
assert.equal(unconfirmed.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.ADAPTED_TO_ENVELOPE);
assert.equal(unconfirmed.canClaimVerifiedRepoFacts, false);
assert.equal(unconfirmed.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.UNCONFIRMED);
assertHardBoundaries(unconfirmed);

const stale = adaptLivingRepoSourceProviderResult({
  providerResult: {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER,
    target: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "README.md",
      scope: "repo_file",
    },
    payload: { text: "stale payload" },
    confirmed: true,
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  },
});

assert.equal(stale.ok, false);
assert.equal(stale.status, LIVING_REPO_PROVIDER_RESULT_ADAPTER_STATUS.ADAPTED_TO_ENVELOPE);
assert.equal(stale.canClaimVerifiedRepoFacts, false);
assert.equal(stale.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.STALE);
assertHardBoundaries(stale);

console.log("Smoke Living SG Repo Source Provider Result Adapter — OK");
