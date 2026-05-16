// scripts/smokeProjectMemoryTrustedEventSourceOrchestratorBridge.js
// SG 2.0 — Project Memory Trusted Event Source -> Orchestrator bridge smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  createTrustedProjectEventForPrMerged,
  processTrustedEventSourceOutputThroughOrchestrator,
} from "../src/memory/index.js";

const trustedEventSourceResult = createTrustedProjectEventForPrMerged({
  request: {
    explicitTrustedEventSourceRequest: true,
  },
  pr: {
    number: 264,
    title: "observation: remove unused webhook detour",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/264",
    repositoryFullName: "korzh260609-beep/garya-bot",
    baseBranch: "dev/v2-start",
    headSha: "72dbd9932b9d8d74bfc3744438b4aea5fa6c93b1",
    mergedAt: "2026-05-16T07:09:10Z",
  },
});

assert.equal(trustedEventSourceResult.ok, true);
assert.equal(trustedEventSourceResult.trustedEventCreated, true);
assert.equal(trustedEventSourceResult.suggestedOrchestratorRequest.autoConfirm, false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "PR #264 merged — observation: remove unused webhook detour");
    assert.equal(input.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/264");
    assert.equal(input.metadata.prNumber, 264);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(createdBy, "smoke-test");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_trusted_source_bridge");
    assert.equal(actor.role, "system");

    return {
      ok: true,
      mode: "explicit_only",
      decision: "candidate_created_for_confirmation",
      stored: true,
      requiresConfirmation: true,
      candidate: {
        ok: true,
        item: input,
      },
      entry: {
        id: "pm_smoke_trusted_source_bridge",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },
};

const result = await processTrustedEventSourceOutputThroughOrchestrator({
  trustedEventSourceResult,
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test",
  traceId: "pmtrace_smoke_trusted_source_bridge",
});

assert.equal(result.ok, true);
assert.equal(result.dispatched, true);
assert.equal(result.candidatePrepared, true);
assert.equal(result.stored, true);
assert.equal(result.confirmed, false);
assert.equal(result.requiresConfirmation, true);
assert.equal(result.orchestrator.confirmed, false);
assert.equal(result.orchestrator.requiresConfirmation, true);
assert.equal(result.orchestrator.durable.stored, true);
assert.equal(result.boundaries.forcedAutoConfirmFalse, true);
assert.equal(result.boundaries.callsAI, false);
assert.equal(result.boundaries.touchesTelegram, false);
assert.equal(result.boundaries.sourceSync, false);
assert.equal(result.boundaries.writesRuntimeFiles, false);

console.log("smokeProjectMemoryTrustedEventSourceOrchestratorBridge: ok");
