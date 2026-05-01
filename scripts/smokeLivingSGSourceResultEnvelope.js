// scripts/smokeLivingSGSourceResultEnvelope.js
// ============================================================================
// Smoke — Living SG Source Result Envelope
//
// Verifies that the sourceResult envelope contract:
// - can represent confirmed source evidence;
// - blocks verified claims when source evidence is missing/invalid/stale;
// - remains separate from planner metadata;
// - never authorizes repository writes;
// - performs no runtime source calls.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS,
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

function assertEnvelopeSafety(envelope) {
  assert.equal(envelope.dryRun, true, "envelope must be dryRun skeleton");
  assert.equal(envelope.canAuthorizeWrite, false, "envelope must not authorize writes");
  assert.equal(envelope.canExecute, false, "envelope must not execute actions");
  assert.equal(envelope.metadata.noSourceCall, true, "envelope must not call sources");
  assert.equal(envelope.metadata.noRuntimeRepoRead, true, "envelope must not read repo runtime");
  assert.equal(envelope.metadata.noRuntimeRepoWrite, true, "envelope must not write repo runtime");
  assert.equal(envelope.metadata.noExecutor, true, "envelope must not create executor");
  assert.equal(
    envelope.metadata.noRepoStateAgentRuntime,
    true,
    "envelope must not connect RepoStateAgent runtime"
  );
  assert.equal(
    envelope.metadata.separateFromPlannerMetadata,
    true,
    "envelope must remain separate from planner metadata"
  );
}

const confirmedRepoEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    path: "package.json",
    scope: "repo_file",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-01T18:20:00Z",
  sourceUpdatedAt: "2026-05-01T18:05:00Z",
  payload: {
    path: "package.json",
    sha: "example-sha",
  },
  valid: true,
  confirmed: true,
  confirmedBy: "runtime-source",
  reason: "runtime_source_result_confirmed",
});

assert.equal(confirmedRepoEnvelope.ok, true);
assert.equal(confirmedRepoEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(
  confirmedRepoEnvelope.confirmation.status,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.CONFIRMED
);
assert.equal(
  confirmedRepoEnvelope.canClaimVerifiedFacts,
  true,
  "confirmed fresh valid payload may allow verified factual claims"
);
assertEnvelopeSafety(confirmedRepoEnvelope);

const missingPayloadEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: null,
  valid: true,
  confirmed: true,
});

assert.equal(
  missingPayloadEnvelope.confirmation.status,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.MISSING
);
assert.equal(missingPayloadEnvelope.canClaimVerifiedFacts, false);
assertEnvelopeSafety(missingPayloadEnvelope);

const invalidEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: { path: "package.json" },
  valid: false,
  confirmed: true,
});

assert.equal(
  invalidEnvelope.confirmation.status,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.INVALID
);
assert.equal(invalidEnvelope.canClaimVerifiedFacts, false);
assertEnvelopeSafety(invalidEnvelope);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: { path: "package.json" },
  valid: true,
  confirmed: true,
});

assert.equal(
  staleEnvelope.confirmation.status,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.STALE
);
assert.equal(staleEnvelope.canClaimVerifiedFacts, false);
assertEnvelopeSafety(staleEnvelope);

const unconfirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: { path: "package.json" },
  valid: true,
  confirmed: false,
});

assert.equal(
  unconfirmedEnvelope.confirmation.status,
  LIVING_SOURCE_RESULT_CONFIRMATION_STATUS.UNCONFIRMED
);
assert.equal(unconfirmedEnvelope.canClaimVerifiedFacts, false);
assertEnvelopeSafety(unconfirmedEnvelope);

console.log("Smoke Living SG Source Result Envelope — OK");
