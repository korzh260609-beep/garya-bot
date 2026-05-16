// scripts/smokeAiToolRuntimeCommandAdapter.js
// SG 2.0 — Controlled AI Tool Runtime Command Adapter smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  AI_TOOL_NAMES,
} from "../src/ai/tools/index.js";
import {
  buildAiToolRuntimeCommandAdapterStatus,
  handleAiToolRuntimeCommand,
} from "../src/ai/runtime/index.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
} from "../src/memory/index.js";

const status = buildAiToolRuntimeCommandAdapterStatus();
assert.equal(status.ok, true);
assert.equal(status.canAdaptStructuredInternalCommand, true);
assert.equal(status.canParseRawChat, false);
assert.equal(status.canCallAIProviders, false);
assert.equal(status.canUseProviderFunctionCalling, false);
assert.equal(status.boundaries.internalCommandAdapterOnly, true);
assert.equal(status.boundaries.structuredCommandOnly, true);
assert.equal(status.boundaries.parsesRawChat, false);
assert.equal(status.boundaries.touchesTelegram, false);
assert.equal(status.boundaries.callsAI, false);
assert.equal(status.boundaries.usesProviderFunctionCalling, false);
assert.equal(status.boundaries.fetchesGitHub, false);
assert.equal(status.boundaries.fetchesRender, false);
assert.equal(status.boundaries.fetchesSources, false);
assert.equal(status.boundaries.sourceSync, false);
assert.equal(status.boundaries.writesRuntimeFiles, false);
assert.equal(status.boundaries.modifiesRepository, false);
assert.equal(status.boundaries.changesEnvironment, false);
assert.equal(status.boundaries.canAutoConfirmMemory, false);
assert.equal(status.boundaries.writesConfirmedMemory, false);

const missingExplicit = await handleAiToolRuntimeCommand({
  command: {
    commandName: "pm.runtime_trusted_event",
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
  },
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_runtime_command_request");
assert.equal(missingExplicit.dispatched, false);

const missingTool = await handleAiToolRuntimeCommand({
  command: {
    explicitRuntimeCommandRequest: true,
    commandName: "pm.runtime_trusted_event",
  },
});
assert.equal(missingTool.ok, false);
assert.equal(missingTool.reason, "missing_tool_name");
assert.equal(missingTool.dispatched, false);

const unknownTool = await handleAiToolRuntimeCommand({
  command: {
    explicitRuntimeCommandRequest: true,
    commandName: "unknown",
    toolName: "unknown.tool",
  },
});
assert.equal(unknownTool.ok, false);
assert.equal(unknownTool.reason, "runtime_tool_not_allowlisted");
assert.equal(unknownTool.dispatched, false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "PR #269 merged — project-memory: add development plan");
    assert.equal(input.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/269");
    assert.equal(input.metadata.prNumber, 269);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);
    assert.equal(createdBy, "smoke-test-ai-tool-runtime-command-adapter");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_ai_tool_runtime_command_adapter");
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
        id: "pm_smoke_ai_tool_runtime_command_adapter",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },
};

const result = await handleAiToolRuntimeCommand({
  command: {
    explicitRuntimeCommandRequest: true,
    commandName: "pm.runtime_trusted_event",
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
    traceId: "pmtrace_smoke_ai_tool_runtime_command_adapter",
    input: {
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      pr: {
        number: 269,
        title: "project-memory: add development plan",
        sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/269",
        repositoryFullName: "korzh260609-beep/garya-bot",
        baseBranch: "dev/v2-start",
        headSha: "4e9b6e91ec4824ba49fdf16d483b414d938d7e80",
        mergedAt: "2026-05-16T08:58:02Z",
      },
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-ai-tool-runtime-command-adapter",
});

assert.equal(result.ok, true);
assert.equal(result.dispatched, true);
assert.equal(result.commandName, "pm.runtime_trusted_event");
assert.equal(result.toolName, AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT);
assert.equal(result.runtimeInvocation.ok, true);
assert.equal(result.runtimeInvocation.dispatched, true);
assert.equal(result.runtimeInvocation.toolResult.ok, true);
assert.equal(result.runtimeInvocation.toolResult.result.ok, true);
assert.equal(result.runtimeInvocation.toolResult.result.trustedEventCreated, true);
assert.equal(result.runtimeInvocation.toolResult.result.candidatePrepared, true);
assert.equal(result.runtimeInvocation.toolResult.result.stored, true);
assert.equal(result.runtimeInvocation.toolResult.result.confirmed, false);
assert.equal(result.runtimeInvocation.toolResult.result.requiresConfirmation, true);
assert.equal(result.boundaries.parsesRawChat, false);
assert.equal(result.boundaries.touchesTelegram, false);
assert.equal(result.boundaries.callsAI, false);
assert.equal(result.boundaries.usesProviderFunctionCalling, false);
assert.equal(result.boundaries.fetchesGitHub, false);
assert.equal(result.boundaries.fetchesRender, false);
assert.equal(result.boundaries.fetchesSources, false);
assert.equal(result.boundaries.sourceSync, false);
assert.equal(result.boundaries.writesRuntimeFiles, false);
assert.equal(result.boundaries.modifiesRepository, false);
assert.equal(result.boundaries.changesEnvironment, false);
assert.equal(result.boundaries.canAutoConfirmMemory, false);
assert.equal(result.boundaries.writesConfirmedMemory, false);

console.log("smokeAiToolRuntimeCommandAdapter: ok");
