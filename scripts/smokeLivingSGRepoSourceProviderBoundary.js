// scripts/smokeLivingSGRepoSourceProviderBoundary.js
// ============================================================================
// Smoke — Living SG Repo Source Provider Boundary
//
// Contract smoke for disconnected provider boundary skeleton.
//
// Boundaries:
// - no repository reads;
// - no repository writes;
// - no source calls;
// - no GitHub token usage;
// - no executor;
// - no RepoStateAgent runtime;
// - no Human Meaning Provider;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
  LIVING_REPO_SOURCE_PROVIDER_STATUS,
  createLivingRepoSourceProviderBoundary,
} from "../src/core/living-sg/LivingRepoSourceProviderBoundary.js";
import {
  LIVING_REPO_READ_PROOF_FORMAT,
  LIVING_REPO_READ_REQUEST_KIND,
} from "../src/core/living-sg/LivingRepoReadRequestPlan.js";
import {
  LIVING_SOURCE_RESULT_KIND,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

const notRequested = createLivingRepoSourceProviderBoundary({});

assert.equal(notRequested.ok, true);
assert.equal(notRequested.dryRun, true);
assert.equal(notRequested.status, LIVING_REPO_SOURCE_PROVIDER_STATUS.NOT_REQUESTED);
assert.equal(notRequested.canReadRepo, false);
assert.equal(notRequested.canWriteRepo, false);
assert.equal(notRequested.canExecute, false);
assert.equal(notRequested.canClaimVerifiedRepoFacts, false);
assert.equal(notRequested.metadata.noSourceCall, true);
assert.equal(notRequested.metadata.noRuntimeRepoRead, true);
assert.equal(notRequested.metadata.noRuntimeRepoWrite, true);
assert.equal(notRequested.metadata.noGitHubTokenUsage, true);
assert.equal(notRequested.metadata.noExecutor, true);
assert.equal(notRequested.metadata.noRepoStateAgentRuntime, true);
assert.equal(notRequested.metadata.noHumanMeaningProvider, true);
assert.equal(notRequested.metadata.noTechnicalModeExpansion, true);
assert.equal(notRequested.metadata.noSlashCommandsAdded, true);

const planned = createLivingRepoSourceProviderBoundary({
  requested: true,
  providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  repository: "korzh260609-beep/garya-bot",
  ref: "main",
  path: "src/core/handleMessage/legacyProjectIntentFlow.js",
  scope: "repo_file",
});

assert.equal(planned.ok, true);
assert.equal(planned.dryRun, true);
assert.equal(planned.status, LIVING_REPO_SOURCE_PROVIDER_STATUS.PROVIDER_NOT_CONNECTED);
assert.equal(planned.providerKind, LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER);
assert.equal(planned.requestKind, LIVING_REPO_READ_REQUEST_KIND.REPO_FILE);
assert.equal(planned.shouldRequestProvider, true);
assert.equal(planned.requiresRuntimeProvider, true);
assert.equal(planned.canReadRepo, false);
assert.equal(planned.canWriteRepo, false);
assert.equal(planned.canExecute, false);
assert.equal(planned.canClaimVerifiedRepoFacts, false);
assert.equal(planned.sourceResultEnvelope, null);

assert.equal(
  planned.expectedSourceResultEnvelope.format,
  LIVING_REPO_READ_PROOF_FORMAT.SOURCE_RESULT_ENVELOPE
);
assert.equal(planned.expectedSourceResultEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(planned.expectedSourceResultEnvelope.canAuthorizeWrite, false);
assert.equal(planned.expectedSourceResultEnvelope.canExecute, false);
assert.equal(planned.expectedSourceResultEnvelope.metadata.notProofByItself, true);
assert.equal(planned.expectedSourceResultEnvelope.metadata.noRuntimeRepoRead, true);
assert.equal(planned.expectedSourceResultEnvelope.metadata.noGitHubTokenUsage, true);
assert.equal(planned.expectedSourceResultEnvelope.metadata.noExecutor, true);
assert.equal(planned.expectedSourceResultEnvelope.target.repository, "korzh260609-beep/garya-bot");
assert.equal(planned.expectedSourceResultEnvelope.target.ref, "main");
assert.equal(planned.expectedSourceResultEnvelope.target.path, "src/core/handleMessage/legacyProjectIntentFlow.js");
assert.equal(planned.expectedSourceResultEnvelope.target.scope, "repo_file");

const unknownProvider = createLivingRepoSourceProviderBoundary({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_STATUS,
});

assert.equal(unknownProvider.ok, true);
assert.equal(unknownProvider.status, LIVING_REPO_SOURCE_PROVIDER_STATUS.PROVIDER_REQUIRED);
assert.equal(unknownProvider.shouldRequestProvider, true);
assert.equal(unknownProvider.canReadRepo, false);
assert.equal(unknownProvider.canWriteRepo, false);
assert.equal(unknownProvider.canExecute, false);

const writeBlocked = createLivingRepoSourceProviderBoundary({
  requested: true,
  writeRequested: true,
  providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.GITHUB_PROVIDER,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
});

assert.equal(writeBlocked.ok, false);
assert.equal(writeBlocked.status, LIVING_REPO_SOURCE_PROVIDER_STATUS.WRITE_BLOCKED);
assert.equal(writeBlocked.canReadRepo, false);
assert.equal(writeBlocked.canWriteRepo, false);
assert.equal(writeBlocked.canExecute, false);
assert.equal(writeBlocked.canClaimVerifiedRepoFacts, false);
assert.equal(writeBlocked.metadata.cannotAuthorizeWrites, true);

console.log("Smoke Living SG Repo Source Provider Boundary — OK");
