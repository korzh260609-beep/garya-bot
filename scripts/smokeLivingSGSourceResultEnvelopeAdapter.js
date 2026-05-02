// scripts/smokeLivingSGSourceResultEnvelopeAdapter.js
// ============================================================================
// Smoke — Living SG Source Result Envelope Adapter
//
// Verifies that an already-existing legacy sourceResult can be adapted into a
// Living SG sourceResultEnvelope without executing sources or authorizing writes.
// ============================================================================

import assert from "node:assert/strict";

import {
  adaptLegacySourceResultToEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelopeAdapter.js";
import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
  LIVING_SOURCE_RESULT_KIND,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

function assertAdapterSafety(result) {
  assert.equal(result.dryRun, true, "adapter must remain dryRun");
  assert.equal(result.metadata.noSourceCall, true, "adapter must not execute sources");
  assert.equal(result.metadata.noRuntimeRepoRead, true, "adapter must not read repo runtime");
  assert.equal(result.metadata.noRuntimeRepoWrite, true, "adapter must not write repo runtime");
  assert.equal(result.metadata.noExecutor, true, "adapter must not create/use executor");
  assert.equal(result.metadata.noRepoStateAgentRuntime, true, "adapter must not connect RepoStateAgent runtime");
  assert.equal(result.metadata.noHumanMeaningProvider, true, "adapter must not connect Human Meaning Provider");
  assert.equal(result.metadata.noTechnicalModeExpansion, true, "adapter must not expand Technical Mode");
  assert.equal(result.metadata.noSlashCommandsAdded, true, "adapter must not add slash commands");
  assert.equal(result.metadata.noRuntimeWiring, true, "adapter must not wire runtime yet");
  assert.equal(result.metadata.cannotAuthorizeWrites, true, "adapter metadata must block writes");
}

const adapted = adaptLegacySourceResultToEnvelope({
  sourceCtx: {
    sourcePlan: {
      decision: "legacy_source_result",
    },
  },
  sourceResult: {
    ok: true,
    sourceKey: "github_repo_status",
    content: "repo status content",
    fetchedAt: "2026-05-01T22:30:00Z",
    meta: {
      repository: "korzh260609-beep/garya-bot",
      ref: "main",
      path: "package.json",
      scope: "repo_file",
    },
  },
});

assertAdapterSafety(adapted);
assert.equal(adapted.ok, true);
assert.equal(adapted.reason, "legacy_source_result_adapted");
assert.ok(adapted.sourceResultEnvelope, "adapter must return envelope for valid legacy sourceResult");
assert.equal(adapted.sourceResultEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(adapted.sourceResultEnvelope.target.repository, "korzh260609-beep/garya-bot");
assert.equal(adapted.sourceResultEnvelope.target.ref, "main");
assert.equal(adapted.sourceResultEnvelope.target.path, "package.json");
assert.equal(adapted.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED);
assert.equal(adapted.sourceResultEnvelope.canClaimVerifiedFacts, true);
assert.equal(adapted.sourceResultEnvelope.canAuthorizeWrite, false);
assert.equal(adapted.sourceResultEnvelope.canExecute, false);
assert.equal(adapted.sourceResultEnvelope.payload.content, "repo status content");
assert.equal(adapted.sourceResultEnvelope.payload.legacySourceResult, true);

const invalid = adaptLegacySourceResultToEnvelope({
  sourceResult: {
    ok: true,
    sourceKey: "rss_news",
    content: "",
    fetchedAt: "2026-05-01T22:30:00Z",
  },
});

assertAdapterSafety(invalid);
assert.equal(invalid.ok, false);
assert.equal(invalid.reason, "legacy_source_result_invalid_or_empty");
assert.ok(invalid.sourceResultEnvelope, "invalid result should still return a not-verified envelope");
assert.equal(invalid.sourceResultEnvelope.confirmation.status, LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.MISSING);
assert.equal(invalid.sourceResultEnvelope.canClaimVerifiedFacts, false);
assert.equal(invalid.sourceResultEnvelope.canAuthorizeWrite, false);

const missing = adaptLegacySourceResultToEnvelope({});

assertAdapterSafety(missing);
assert.equal(missing.ok, false);
assert.equal(missing.reason, "legacy_source_result_missing");
assert.equal(missing.sourceResultEnvelope, null);

console.log("Smoke Living SG Source Result Envelope Adapter — OK");
