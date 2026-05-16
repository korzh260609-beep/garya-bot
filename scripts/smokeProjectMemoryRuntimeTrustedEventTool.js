// scripts/smokeProjectMemoryRuntimeTrustedEventTool.js
// SG 2.0 — Project Memory Runtime Trusted Event Tool smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  buildProjectMemoryRuntimeTrustedEventToolStatus,
  runProjectMemoryRuntimeTrustedEventTool,
} from "../src/memory/index.js";

const status = buildProjectMemoryRuntimeTrustedEventToolStatus();

assert.equal(status.ok, true);
assert.equal(status.canHandlePrMergedTrustedEvent, true);
assert.equal(status.canAutoConfirm, false);
assert.equal(status.boundaries.callsAI, false);
assert.equal(status.boundaries.touchesTelegram, false);
assert.equal(status.boundaries.fetchesGitHub, false);
assert.equal(status.boundaries.fetchesRender, false);
assert.equal(status.boundaries.sourceSync, false);
assert.equal(status.boundaries.writesRuntimeFiles, false);
assert.equal(status.boundaries.modifiesRepository, false);
assert.equal(status.boundaries.changesEnvironment, false);

const rejected = await runProjectMemoryRuntimeTrustedEventTool({
  request: {},
  actor: {
    role: "system",
    isMonarch: false,
  },
});

assert.equal(rejected.ok, false);
assert.equal(rejected.reason, "missing_explicit_runtime_trusted_event_tool_request");
assert.equal(rejected.dispatched, false);
assert.equal(rejected.confirmed, false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "PR #265 merged — project-memory: connect trusted event source to orchestrator");
    assert.equal(input.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/265");
    assert.equal(input.metadata.prNumber, 265);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);
    assert.equal(createdBy, "smoke-test-runtime-tool");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_runtime_trusted_event_tool");
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
        id: "pm_smoke_runtime_trusted_event_tool",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },
};

const result = await runProjectMemoryRuntimeTrustedEventTool({
  request: {
    explicitRuntimeTrustedEventToolRequest: true,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
    traceId: "pmtrace_smoke_runtime_trusted_event_tool",
    pr: {
      number: 265,
      title: "project-memory: connect trusted event source to orchestrator",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/265",
      repositoryFullName: "korzh260609-beep/garya-bot",
      baseBranch: "dev/v2-start",
      headSha: "6403b8541b49634210524d3fddf27d534f798587",
      mergedAt: "2026-05-16T07:23:39Z",
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-runtime-tool",
});

assert.equal(result.ok, true);
assert.equal(result.dispatched, true);
assert.equal(result.trustedEventCreated, true);
assert.equal(result.candidatePrepared, true);
assert.equal(result.stored, true);
assert.equal(result.confirmed, false);
assert.equal(result.requiresConfirmation, true);
assert.equal(result.trustedEventSourceResult.ok, true);
assert.equal(result.trustedEventSourceResult.suggestedOrchestratorRequest.autoConfirm, false);
assert.equal(result.bridge.confirmed, false);
assert.equal(result.bridge.requiresConfirmation, true);
assert.equal(result.bridge.orchestrator.confirmed, false);
assert.equal(result.bridge.orchestrator.requiresConfirmation, true);
assert.equal(result.bridge.orchestrator.durable.stored, true);
assert.equal(result.boundaries.forcedAutoConfirmFalse, true);
assert.equal(result.boundaries.callsAI, false);
assert.equal(result.boundaries.touchesTelegram, false);
assert.equal(result.boundaries.fetchesGitHub, false);
assert.equal(result.boundaries.fetchesRender, false);
assert.equal(result.boundaries.sourceSync, false);
assert.equal(result.boundaries.writesRuntimeFiles, false);
assert.equal(result.boundaries.modifiesRepository, false);
assert.equal(result.boundaries.changesEnvironment, false);

console.log("smokeProjectMemoryRuntimeTrustedEventTool: ok");
