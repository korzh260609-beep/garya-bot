// scripts/smokeGithubWebhookObservationIntakeSkeleton.js
// SG 2.0 — GitHub webhook Observation intake skeleton smoke.
// This smoke is deterministic and offline; it does not call GitHub/Render/AI/Telegram or write Project Memory.

import assert from "node:assert/strict";

import {
  buildGithubWebhookSignature,
  dispatchGithubWebhookObservation,
  getGithubWebhookObservationBridgeBoundaries,
  GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES,
  normalizeGithubWebhookEvent,
  verifyGithubWebhookSignature,
} from "../src/integrations/github/webhook/index.js";

const secret = "test-secret";
const payload = {
  action: "closed",
  pull_request: {
    number: 260,
    title: "observation: probe automatic PR merged dispatch",
    html_url: "https://github.com/korzh260609-beep/garya-bot/pull/260",
    merged: true,
    merged_at: "2026-05-16T05:55:38Z",
    closed_at: "2026-05-16T05:55:38Z",
    merge_commit_sha: "0f37435799b9427194d7b73ea241a863b07c09d9",
    base: {
      ref: "dev/v2-start",
    },
    head: {
      ref: "sg2-observation-auto-dispatch-probe",
      sha: "daaf8b5b0530feed83199cc0227c2584e6eb0e40",
    },
  },
  repository: {
    full_name: "korzh260609-beep/garya-bot",
  },
  sender: {
    login: "korzh260609-beep",
  },
};
const rawBody = JSON.stringify(payload);
const signature = buildGithubWebhookSignature({ secret, rawBody });

const verified = verifyGithubWebhookSignature({ secret, rawBody, signature });
assert.equal(verified.ok, true);
assert.equal(verified.signatureVerified, true);
assert.equal(verified.rawPayloadExposed, false);

const rejected = verifyGithubWebhookSignature({
  secret,
  rawBody,
  signature: "sha256=bad",
});
assert.equal(rejected.ok, false);
assert.equal(rejected.reason, "github_signature_mismatch");
assert.equal(rejected.rawPayloadExposed, false);

const normalized = normalizeGithubWebhookEvent({
  githubEvent: "pull_request",
  payload,
});
assert.equal(normalized.ok, true);
assert.equal(normalized.normalized, true);
assert.equal(normalized.ignored, false);
assert.equal(normalized.eventType, GITHUB_WEBHOOK_NORMALIZED_EVENT_TYPES.PR_MERGED);
assert.equal(normalized.payload.prNumber, 260);
assert.equal(normalized.payload.baseBranch, "dev/v2-start");
assert.equal(normalized.payload.mergeCommitSha, "0f37435799b9427194d7b73ea241a863b07c09d9");
assert.equal(normalized.rawPayloadExposed, false);

const ignoredNotMerged = normalizeGithubWebhookEvent({
  githubEvent: "pull_request",
  payload: {
    ...payload,
    pull_request: {
      ...payload.pull_request,
      merged: false,
    },
  },
});
assert.equal(ignoredNotMerged.ok, true);
assert.equal(ignoredNotMerged.ignored, true);
assert.equal(ignoredNotMerged.reason, "pull_request_closed_without_merge");

const ignoredWrongBranch = normalizeGithubWebhookEvent({
  githubEvent: "pull_request",
  payload: {
    ...payload,
    pull_request: {
      ...payload.pull_request,
      base: { ref: "main" },
    },
  },
});
assert.equal(ignoredWrongBranch.ok, true);
assert.equal(ignoredWrongBranch.ignored, true);
assert.equal(ignoredWrongBranch.reason, "pull_request_base_branch_not_dev_v2_start");

const boundaries = getGithubWebhookObservationBridgeBoundaries();
assert.equal(boundaries.eventDrivenOnly, true);
assert.equal(boundaries.usesCron, false);
assert.equal(boundaries.usesSchedule, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.writesProjectMemory, false);
assert.equal(boundaries.exposesRawPayload, false);

const dispatched = await dispatchGithubWebhookObservation({
  normalizedEvent: normalized,
  context: {
    testProducers: {
      async produceObservationJournalHealthLatest(producerPayload) {
        assert.equal(producerPayload.githubWebhook.prNumber, 260);
        assert.equal(producerPayload.githubWebhook.baseBranch, "dev/v2-start");

        return {
          ok: true,
          type: "observation_report",
          name: "test-observation-journal-health",
        };
      },
    },
  },
});
assert.equal(dispatched.ok, true);
assert.equal(dispatched.dispatched, true);
assert.equal(dispatched.rawPayloadExposed, false);

console.log("smokeGithubWebhookObservationIntakeSkeleton: ok");
