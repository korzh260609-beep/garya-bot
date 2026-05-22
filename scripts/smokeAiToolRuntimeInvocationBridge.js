// scripts/smokeAiToolRuntimeInvocationBridge.js
// SG 2.0 — AI Tool Runtime Invocation Bridge smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  AI_TOOL_NAMES,
} from "../src/ai/tools/index.js";
import {
  buildAiToolRuntimeInvocationBridgeStatus,
  invokeAiToolFromRuntime,
} from "../src/ai/runtime/index.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
} from "../src/memory/index.js";

const status = buildAiToolRuntimeInvocationBridgeStatus();
assert.equal(status.ok, true);
assert.equal(status.canDispatchAllowlistedTools, true);
assert.equal(status.canCallAIProviders, false);
assert.equal(status.canUseProviderFunctionCalling, false);
assert.equal(status.boundaries.callsAI, false);
assert.equal(status.boundaries.usesProviderFunctionCalling, false);
assert.equal(status.boundaries.touchesTelegram, false);
assert.equal(status.boundaries.fetchesGitHub, false);
assert.equal(status.boundaries.fetchesRender, false);
assert.equal(status.boundaries.fetchesSources, false);
assert.equal(status.boundaries.sourceSync, false);
assert.equal(status.boundaries.writesRuntimeFiles, false);
assert.equal(status.boundaries.modifiesRepository, false);
assert.equal(status.boundaries.changesEnvironment, false);
assert.equal(status.boundaries.canAutoConfirmMemory, false);
assert.equal(status.boundaries.writesConfirmedMemory, false);

const missingExplicit = await invokeAiToolFromRuntime({
  request: {
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
  },
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_runtime_tool_invocation_request");
assert.equal(missingExplicit.dispatched, false);

const unknownTool = await invokeAiToolFromRuntime({
  request: {
    explicitRuntimeToolInvocationRequest: true,
    toolName: "unknown.tool",
  },
});
assert.equal(unknownTool.ok, false);
assert.equal(unknownTool.reason, "runtime_tool_not_allowlisted");
assert.equal(unknownTool.dispatched, false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "PR #267 merged — ai-tools: expose project memory runtime trusted event skeleton");
    assert.equal(input.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/267");
    assert.equal(input.metadata.prNumber, 267);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);
    assert.equal(createdBy, "smoke-test-ai-tool-runtime-invocation-bridge");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_ai_tool_runtime_invocation_bridge");
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
        id: "pm_smoke_ai_tool_runtime_invocation_bridge",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },

  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    assert.equal(entryId, "pm_smoke_ai_tool_runtime_invocation_bridge");
    assert.equal(confirmedBy, "system");
    assert.equal(traceId, "pmtrace_smoke_ai_tool_runtime_invocation_bridge");
    assert.equal(approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/267");

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

const result = await invokeAiToolFromRuntime({
  request: {
    explicitRuntimeToolInvocationRequest: true,
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
    traceId: "pmtrace_smoke_ai_tool_runtime_invocation_bridge",
    input: {
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      pr: {
        number: 267,
        title: "ai-tools: expose project memory runtime trusted event skeleton",
        sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/267",
        repositoryFullName: "korzh260609-beep/garya-bot",
        baseBranch: "dev/v2-start",
        headSha: "6514c99a2e18b2cce3cd8450e2c923a0308ac2c3",
        mergedAt: "2026-05-16T08:14:54Z",
      },
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-ai-tool-runtime-invocation-bridge",
});

assert.equal(result.ok, true);
assert.equal(result.dispatched, true);
assert.equal(result.toolName, AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT);
assert.equal(result.toolResult.ok, true);
assert.equal(result.toolResult.dispatched, true);
assert.equal(result.toolResult.result.ok, true);
assert.equal(result.toolResult.result.trustedEventCreated, true);
assert.equal(result.toolResult.result.candidatePrepared, true);
assert.equal(result.toolResult.result.stored, true);
assert.equal(result.toolResult.result.confirmed, true);
assert.equal(result.toolResult.result.requiresConfirmation, false);
assert.equal(result.toolResult.result.bridge.autoConfirm, true);
assert.equal(result.toolResult.result.bridge.autoConfirmReason, "github_pr_merged_trusted_allowlist_passed");
assert.equal(result.toolResult.result.bridge.confirmed, true);
assert.equal(result.toolResult.result.bridge.requiresConfirmation, false);
assert.equal(result.toolResult.result.bridge.orchestrator.confirmed, true);
assert.equal(result.toolResult.result.bridge.orchestrator.trusted.confirmed, true);
assert.equal(result.toolResult.result.entry.trust, "confirmed");
assert.equal(result.toolResult.result.entry.status, "active");
assert.equal(result.boundaries.callsAI, false);
assert.equal(result.boundaries.usesProviderFunctionCalling, false);
assert.equal(result.boundaries.touchesTelegram, false);
assert.equal(result.boundaries.fetchesGitHub, false);
assert.equal(result.boundaries.fetchesRender, false);
assert.equal(result.boundaries.fetchesSources, false);
assert.equal(result.boundaries.sourceSync, false);
assert.equal(result.boundaries.writesRuntimeFiles, false);
assert.equal(result.boundaries.modifiesRepository, false);
assert.equal(result.boundaries.changesEnvironment, false);
assert.equal(result.boundaries.canAutoConfirmMemory, false);
assert.equal(result.boundaries.writesConfirmedMemory, false);

console.log("smokeAiToolRuntimeInvocationBridge: ok");
