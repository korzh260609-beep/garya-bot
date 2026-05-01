// scripts/smokeLivingSGRepoReadPlannerEnvelopeContract.js
// ============================================================================
// Smoke — Living SG Repo Read Planner Envelope Contract
//
// Verifies that RepoReadRequestPlan connects to source-proof/envelope contract
// at planning level only:
// - planner declares expected sourceResult envelope format;
// - planner can pass provided envelope to SourceProofBoundary;
// - planner never reads repo runtime or calls sources;
// - writes remain blocked.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_REPO_READ_PROOF_FORMAT,
  LIVING_REPO_READ_REQUEST_KIND,
  LIVING_REPO_READ_REQUEST_STATUS,
  createLivingRepoReadRequestPlan,
} from "../src/core/living-sg/LivingRepoReadRequestPlan.js";
import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";
import {
  LIVING_SOURCE_PROOF_STATUS,
} from "../src/core/living-sg/LivingSourceProofBoundary.js";

function assertPlannerSafety(plan) {
  assert.equal(plan.dryRun, true, "planner must remain dryRun skeleton");
  assert.equal(plan.canWriteRepo, false, "planner must not allow repo writes");
  assert.equal(plan.metadata.noRuntimeRepoRead, true, "planner must not read repo runtime");
  assert.equal(plan.metadata.noRuntimeRepoWrite, true, "planner must not write repo runtime");
  assert.equal(plan.metadata.noSourceCall, true, "planner must not call sources");
  assert.equal(plan.metadata.noExecutor, true, "planner must not create executor");
  assert.equal(
    plan.metadata.noRepoStateAgentRuntime,
    true,
    "planner must not connect RepoStateAgent runtime"
  );
  assert.equal(
    plan.metadata.expectsSourceResultEnvelope,
    true,
    "planner must declare sourceResult envelope expectation"
  );
}

const plannedWithoutEnvelope = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "package.json",
});

assert.equal(
  plannedWithoutEnvelope.status,
  LIVING_REPO_READ_REQUEST_STATUS.PLANNED_SOURCE_REQUIRED
);
assert.equal(plannedWithoutEnvelope.shouldRequestSource, true);
assert.equal(plannedWithoutEnvelope.canReadRepo, false);
assert.equal(plannedWithoutEnvelope.canClaimVerifiedRepoFacts, false);
assert.equal(
  plannedWithoutEnvelope.expectedSourceResultEnvelope.format,
  LIVING_REPO_READ_PROOF_FORMAT.SOURCE_RESULT_ENVELOPE
);
assert.equal(plannedWithoutEnvelope.expectedSourceResultEnvelope.kind, LIVING_SOURCE_RESULT_KIND.REPO);
assert.equal(plannedWithoutEnvelope.expectedSourceResultEnvelope.canAuthorizeWrite, false);
assert.equal(plannedWithoutEnvelope.sourceProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assertPlannerSafety(plannedWithoutEnvelope);

const confirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    path: "package.json",
    scope: "repo_file",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: { path: "package.json", sha: "example-sha" },
  valid: true,
  confirmed: true,
  confirmedBy: "runtime-source",
});

const plannedWithConfirmedEnvelope = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "package.json",
  sourceResultEnvelope: confirmedEnvelope,
});

assert.equal(
  plannedWithConfirmedEnvelope.status,
  LIVING_REPO_READ_REQUEST_STATUS.PLANNED_SOURCE_REQUIRED
);
assert.equal(plannedWithConfirmedEnvelope.canReadRepo, false);
assert.equal(plannedWithConfirmedEnvelope.canWriteRepo, false);
assert.equal(plannedWithConfirmedEnvelope.canClaimVerifiedRepoFacts, true);
assert.equal(plannedWithConfirmedEnvelope.sourceProof.status, LIVING_SOURCE_PROOF_STATUS.VERIFIED);
assert.equal(plannedWithConfirmedEnvelope.sourceProof.canAuthorizeWrite, false);
assert.equal(
  plannedWithConfirmedEnvelope.reason,
  "repo_read_planned_with_confirmed_source_result_envelope"
);
assertPlannerSafety(plannedWithConfirmedEnvelope);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: { path: "package.json" },
  valid: true,
  confirmed: true,
});

const plannedWithStaleEnvelope = createLivingRepoReadRequestPlan({
  requested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "package.json",
  sourceResultEnvelope: staleEnvelope,
});

assert.equal(plannedWithStaleEnvelope.canClaimVerifiedRepoFacts, false);
assert.equal(plannedWithStaleEnvelope.sourceProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assertPlannerSafety(plannedWithStaleEnvelope);

const blockedWritePlan = createLivingRepoReadRequestPlan({
  requested: true,
  writeRequested: true,
  requestKind: LIVING_REPO_READ_REQUEST_KIND.REPO_FILE,
  target: "package.json",
  sourceResultEnvelope: confirmedEnvelope,
});

assert.equal(blockedWritePlan.status, LIVING_REPO_READ_REQUEST_STATUS.BLOCKED_WRITE_REQUEST);
assert.equal(blockedWritePlan.ok, false);
assert.equal(blockedWritePlan.canWriteRepo, false);
assert.equal(blockedWritePlan.canReadRepo, false);
assert.equal(blockedWritePlan.canClaimVerifiedRepoFacts, false);
assert.equal(blockedWritePlan.expectedSourceResultEnvelope.canAuthorizeWrite, false);
assertPlannerSafety(blockedWritePlan);

console.log("Smoke Living SG Repo Read Planner Envelope Contract — OK");
