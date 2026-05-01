// scripts/smokeLivingSGSourceProofEnvelopeInput.js
// ============================================================================
// Smoke — Living SG Source Proof Envelope Input
//
// Verifies that SourceProofBoundary can read sourceResult envelope status as
// contract input only:
// - confirmed fresh valid envelope may allow verified claims;
// - missing/invalid/stale/unconfirmed envelope blocks verified claims;
// - envelope never authorizes writes;
// - source proof still performs no runtime source calls.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";
import {
  LIVING_SOURCE_PROOF_STATUS,
  createLivingSourceProofBoundary,
} from "../src/core/living-sg/LivingSourceProofBoundary.js";

function assertProofSafety(proof) {
  assert.equal(proof.dryRun, true, "source proof must remain dryRun skeleton");
  assert.equal(proof.canAuthorizeWrite, false, "source proof must not authorize writes");
  assert.equal(proof.metadata.noSourceCall, true, "source proof must not call sources");
  assert.equal(proof.metadata.noRuntimeRepoRead, true, "source proof must not read repo runtime");
  assert.equal(proof.metadata.noRuntimeRepoWrite, true, "source proof must not write repo runtime");
  assert.equal(proof.metadata.noExecutor, true, "source proof must not create executor");
  assert.equal(
    proof.metadata.noRepoStateAgentRuntime,
    true,
    "source proof must not connect RepoStateAgent runtime"
  );
  assert.equal(
    proof.metadata.sourceResultEnvelopeIsProofInputOnly,
    true,
    "sourceResult envelope must be proof input only"
  );
}

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

const confirmedProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultEnvelope: confirmedEnvelope,
});

assert.equal(confirmedProof.status, LIVING_SOURCE_PROOF_STATUS.VERIFIED);
assert.equal(confirmedProof.verified, true);
assert.equal(confirmedProof.canClaimVerifiedFacts, true);
assert.equal(confirmedProof.reason, "source_result_envelope_confirmed");
assertProofSafety(confirmedProof);

const missingEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: null,
  valid: true,
  confirmed: true,
});

const missingProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultEnvelope: missingEnvelope,
});

assert.equal(missingProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assert.equal(missingProof.verified, false);
assert.equal(missingProof.canClaimVerifiedFacts, false);
assert.equal(missingProof.reason, "source_result_envelope_missing");
assertProofSafety(missingProof);

const invalidEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: { path: "package.json" },
  valid: false,
  confirmed: true,
});

const invalidProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultEnvelope: invalidEnvelope,
});

assert.equal(invalidProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assert.equal(invalidProof.canClaimVerifiedFacts, false);
assert.equal(invalidProof.reason, "source_result_envelope_invalid");
assertProofSafety(invalidProof);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: { path: "package.json" },
  valid: true,
  confirmed: true,
});

const staleProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultEnvelope: staleEnvelope,
});

assert.equal(staleProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assert.equal(staleProof.canClaimVerifiedFacts, false);
assert.equal(staleProof.reason, "source_result_envelope_stale");
assertProofSafety(staleProof);

const unconfirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  payload: { path: "package.json" },
  valid: true,
  confirmed: false,
});

const unconfirmedProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultEnvelope: unconfirmedEnvelope,
});

assert.equal(unconfirmedProof.status, LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED);
assert.equal(unconfirmedProof.canClaimVerifiedFacts, false);
assert.equal(unconfirmedProof.reason, "source_result_envelope_unconfirmed");
assertProofSafety(unconfirmedProof);

const legacyFallbackProof = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  requested: true,
  sourceResultConfirmed: true,
  sourcePayload: { path: "package.json" },
});

assert.equal(legacyFallbackProof.status, LIVING_SOURCE_PROOF_STATUS.VERIFIED);
assert.equal(legacyFallbackProof.canClaimVerifiedFacts, true);
assert.equal(legacyFallbackProof.canAuthorizeWrite, false);
assertProofSafety(legacyFallbackProof);

console.log("Smoke Living SG Source Proof Envelope Input — OK");
