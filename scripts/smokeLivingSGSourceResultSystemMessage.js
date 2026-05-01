// scripts/smokeLivingSGSourceResultSystemMessage.js
// ============================================================================
// Smoke — Living SG Source Result System Message
//
// Verifies that the builder converts sourceResult envelopes into prompt-safe
// system evidence without executing anything.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";
import {
  buildLivingSourceResultSystemMessage,
} from "../src/core/living-sg/LivingSourceResultSystemMessage.js";

function assertSystemEvidenceSafety(message) {
  assert.equal(message.role, "system", "source result evidence must be a system message");
  assert.ok(
    message.content.includes("SOURCE RESULT SYSTEM EVIDENCE:"),
    "message must be marked as source result system evidence"
  );
  assert.ok(
    message.content.includes("canAuthorizeWrite=false"),
    "message must never authorize writes"
  );
  assert.ok(
    message.content.includes("does not execute sources"),
    "message must say it does not execute sources"
  );
  assert.ok(
    message.content.includes("read repositories"),
    "message must say it does not read repositories"
  );
  assert.ok(
    message.content.includes("A confirmed read result never authorizes write actions"),
    "message must separate read proof from write authority"
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
  checkedAt: "2026-05-01T19:00:00Z",
  sourceUpdatedAt: "2026-05-01T18:45:00Z",
  payload: { path: "package.json", sha: "example-sha" },
  valid: true,
  confirmed: true,
  confirmedBy: "runtime-source",
  reason: "runtime_source_result_confirmed",
});

const confirmedMessage = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: confirmedEnvelope,
});

assertSystemEvidenceSafety(confirmedMessage);
assert.ok(confirmedMessage.content.includes("status=confirmed"));
assert.ok(confirmedMessage.content.includes("verified=true"));
assert.ok(confirmedMessage.content.includes("canClaimVerifiedFacts=true"));
assert.ok(confirmedMessage.content.includes("kind=repo"));
assert.ok(confirmedMessage.content.includes("repository=korzh260609-beep/garya-bot"));
assert.ok(
  confirmedMessage.content.includes("may support verified repository/source claims only for the stated target")
);

const missingMessage = buildLivingSourceResultSystemMessage({});

assertSystemEvidenceSafety(missingMessage);
assert.ok(missingMessage.content.includes("status=missing"));
assert.ok(missingMessage.content.includes("verified=false"));
assert.ok(missingMessage.content.includes("sourceResultEnvelopePresent=false"));
assert.ok(
  missingMessage.content.includes("Do not present repository/source facts as verified")
);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "package.json",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: { path: "package.json" },
  valid: true,
  confirmed: true,
});

const staleMessage = buildLivingSourceResultSystemMessage({
  sourceResultEnvelope: staleEnvelope,
});

assertSystemEvidenceSafety(staleMessage);
assert.ok(staleMessage.content.includes("status=stale"));
assert.ok(staleMessage.content.includes("verified=false"));
assert.ok(staleMessage.content.includes("canClaimVerifiedFacts=false"));
assert.ok(
  staleMessage.content.includes("not confirmed for verified claims")
);

console.log("Smoke Living SG Source Result System Message — OK");
