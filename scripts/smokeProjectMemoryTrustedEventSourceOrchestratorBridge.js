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
  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    assert.equal(entryId, "pm_smoke_trusted_source_bridge");
    assert.equal(confirmedBy, "system");
    assert.equal(traceId, "pmtrace_smoke_trusted_source_bridge");
    assert.equal(approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/264");

    return {
      ok: true,
      entry: {
        id: entryId,
        trust: "confirmed",
        status: "active",
      },
      trust: "confirmed",
      traceId,
      approvalRef,
    };
  },
};

const pendingResult = await processTrustedEventSourceOutputThroughOrchestrator({
  trustedEventSourceResult,
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test",
  traceId: "pmtrace_smoke_trusted_source_bridge",
});

assert.equal(pendingResult.ok, true);
assert.equal(pendingResult.dispatched, true);
assert.equal(pendingResult.candidatePrepared, true);
assert.equal(pendingResult.stored, true);
assert.equal(pendingResult.confirmed, false);
assert.equal(pendingResult.requiresConfirmation, true);
assert.equal(pendingResult.autoConfirm, false);
assert.equal(pendingResult.autoConfirmReason, "auto_confirm_not_requested_by_trusted_source");
assert.equal(pendingResult.autoConfirmationPolicyResult, null);
assert.equal(pendingResult.orchestrator.confirmed, false);
assert.equal(pendingResult.orchestrator.requiresConfirmation, true);
assert.equal(pendingResult.orchestrator.durable.stored, true);
assert.equal(pendingResult.boundaries.forcedAutoConfirmFalse, false);
assert.equal(pendingResult.boundaries.policyGatedAutoConfirm, true);
assert.equal(pendingResult.boundaries.usesProjectMemoryAutoConfirmationPolicy, true);
assert.equal(pendingResult.boundaries.autoConfirmRequiresPolicyAllow, true);
assert.equal(pendingResult.boundaries.callsAI, false);
assert.equal(pendingResult.boundaries.touchesTelegram, false);
assert.equal(pendingResult.boundaries.sourceSync, false);
assert.equal(pendingResult.boundaries.writesRuntimeFiles, false);

const verifiedAutoConfirmSourceResult = {
  ...trustedEventSourceResult,
  suggestedOrchestratorRequest: {
    ...trustedEventSourceResult.suggestedOrchestratorRequest,
    autoConfirm: true,
    evidence: {
      eventType: trustedEventSourceResult.event.eventType,
      sourceRef: trustedEventSourceResult.event.sourceRef,
      approvalRef: trustedEventSourceResult.event.sourceRef,
      verified: true,
    },
  },
};

const confirmedResult = await processTrustedEventSourceOutputThroughOrchestrator({
  trustedEventSourceResult: verifiedAutoConfirmSourceResult,
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test",
  traceId: "pmtrace_smoke_trusted_source_bridge",
});

assert.equal(confirmedResult.ok, true);
assert.equal(confirmedResult.dispatched, true);
assert.equal(confirmedResult.candidatePrepared, true);
assert.equal(confirmedResult.stored, true);
assert.equal(confirmedResult.confirmed, true);
assert.equal(confirmedResult.requiresConfirmation, false);
assert.equal(confirmedResult.autoConfirm, true);
assert.equal(confirmedResult.autoConfirmReason, "github_pr_merged_trusted_allowlist_passed");
assert.equal(confirmedResult.autoConfirmationPolicyResult.allowed, true);
assert.equal(confirmedResult.autoConfirmationPolicyResult.evidence.repositoryFullName, "korzh260609-beep/garya-bot");
assert.equal(confirmedResult.autoConfirmationPolicyResult.evidence.baseBranch, "dev/v2-start");
assert.equal(confirmedResult.autoConfirmationPolicyResult.evidence.headSha, "72dbd9932b9d8d74bfc3744438b4aea5fa6c93b1");
assert.equal(confirmedResult.orchestrator.confirmed, true);
assert.equal(confirmedResult.orchestrator.trusted.confirmed, true);
assert.equal(confirmedResult.entry.trust, "confirmed");
assert.equal(confirmedResult.entry.status, "active");

const wrongBranchAutoConfirmSourceResult = {
  ...trustedEventSourceResult,
  suggestedOrchestratorRequest: {
    ...trustedEventSourceResult.suggestedOrchestratorRequest,
    autoConfirm: true,
    event: {
      ...trustedEventSourceResult.event,
      metadata: {
        ...trustedEventSourceResult.event.metadata,
        baseBranch: "main",
      },
    },
    evidence: {
      eventType: trustedEventSourceResult.event.eventType,
      sourceRef: trustedEventSourceResult.event.sourceRef,
      approvalRef: trustedEventSourceResult.event.sourceRef,
      verified: true,
    },
  },
};

const blockedResult = await processTrustedEventSourceOutputThroughOrchestrator({
  trustedEventSourceResult: wrongBranchAutoConfirmSourceResult,
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test",
  traceId: "pmtrace_smoke_trusted_source_bridge",
});

assert.equal(blockedResult.ok, true);
assert.equal(blockedResult.dispatched, true);
assert.equal(blockedResult.candidatePrepared, true);
assert.equal(blockedResult.stored, true);
assert.equal(blockedResult.confirmed, false);
assert.equal(blockedResult.requiresConfirmation, true);
assert.equal(blockedResult.autoConfirm, false);
assert.equal(blockedResult.autoConfirmReason, "wrong_branch");
assert.equal(blockedResult.autoConfirmationPolicyResult.allowed, false);
assert.equal(blockedResult.warnings.some((warning) => warning.code === "auto_confirm_blocked_by_project_memory_policy"), true);

console.log("smokeProjectMemoryTrustedEventSourceOrchestratorBridge: ok");
