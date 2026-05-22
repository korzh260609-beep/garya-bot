// scripts/smokeAiToolRegistryProjectMemoryRuntimeTrustedEvent.js
// SG 2.0 — AI Tool Registry -> Project Memory Runtime Trusted Event smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI.

import assert from "node:assert/strict";

import {
  AI_TOOL_NAMES,
  buildAiToolRegistryStatus,
  findAiToolManifest,
  listAiToolManifests,
  runAiTool,
} from "../src/ai/tools/index.js";
import {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
} from "../src/memory/index.js";

const status = buildAiToolRegistryStatus();
assert.equal(status.ok, true);
assert.equal(status.toolsCount, 1);
assert.equal(status.boundaries.callsAI, false);
assert.equal(status.boundaries.touchesTelegram, false);
assert.equal(status.boundaries.fetchesGitHub, false);
assert.equal(status.boundaries.fetchesRender, false);
assert.equal(status.boundaries.sourceSync, false);
assert.equal(status.boundaries.writesRuntimeFiles, false);
assert.equal(status.boundaries.modifiesRepository, false);
assert.equal(status.boundaries.writesConfirmedMemory, false);
assert.equal(status.boundaries.canAutoConfirmMemory, false);

const manifests = listAiToolManifests();
assert.equal(manifests.length, 1);
assert.equal(manifests[0].name, AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT);
assert.equal(manifests[0].boundaries.autoConfirm, false);
assert.equal(manifests[0].boundaries.callsAI, false);
assert.equal(manifests[0].boundaries.touchesTelegram, false);
assert.equal(manifests[0].boundaries.fetchesGitHub, false);
assert.equal(manifests[0].boundaries.fetchesRender, false);
assert.equal(manifests[0].boundaries.sourceSync, false);

assert.equal(
  findAiToolManifest(AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT)?.name,
  AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
);
assert.equal(findAiToolManifest("unknown.tool"), null);

const missingExplicit = await runAiTool({
  request: {
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
  },
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_ai_tool_request");
assert.equal(missingExplicit.dispatched, false);

const unknownTool = await runAiTool({
  request: {
    explicitAiToolRequest: true,
    toolName: "unknown.tool",
  },
});
assert.equal(unknownTool.ok, false);
assert.equal(unknownTool.reason, "unknown_ai_tool");
assert.equal(unknownTool.dispatched, false);

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    assert.equal(input.type, "implementation_status");
    assert.equal(input.title, "PR #266 merged — project-memory: add runtime trusted event tool skeleton");
    assert.equal(input.sourceRef, "https://github.com/korzh260609-beep/garya-bot/pull/266");
    assert.equal(input.metadata.prNumber, 266);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);
    assert.equal(createdBy, "smoke-test-ai-tool-registry");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_ai_tool_registry_runtime_trusted_event");
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
        id: "pm_smoke_ai_tool_registry_runtime_trusted_event",
        projectKey,
        title: input.title,
        trust: "candidate",
        status: "pending_confirmation",
      },
      traceId,
    };
  },

  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    assert.equal(entryId, "pm_smoke_ai_tool_registry_runtime_trusted_event");
    assert.equal(confirmedBy, "system");
    assert.equal(traceId, "pmtrace_smoke_ai_tool_registry_runtime_trusted_event");
    assert.equal(approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/266");

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

const result = await runAiTool({
  request: {
    explicitAiToolRequest: true,
    toolName: AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT,
    traceId: "pmtrace_smoke_ai_tool_registry_runtime_trusted_event",
    input: {
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      pr: {
        number: 266,
        title: "project-memory: add runtime trusted event tool skeleton",
        sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/266",
        repositoryFullName: "korzh260609-beep/garya-bot",
        baseBranch: "dev/v2-start",
        headSha: "ecbfabef86b7350cb716d4030cc6d76026a1864c",
        mergedAt: "2026-05-16T07:51:56Z",
      },
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-ai-tool-registry",
});

assert.equal(result.ok, true);
assert.equal(result.dispatched, true);
assert.equal(result.toolName, AI_TOOL_NAMES.PROJECT_MEMORY_RUNTIME_TRUSTED_EVENT);
assert.equal(result.result.ok, true);
assert.equal(result.result.dispatched, true);
assert.equal(result.result.trustedEventCreated, true);
assert.equal(result.result.candidatePrepared, true);
assert.equal(result.result.stored, true);
assert.equal(result.result.confirmed, true);
assert.equal(result.result.requiresConfirmation, false);
assert.equal(result.result.bridge.autoConfirm, true);
assert.equal(result.result.bridge.autoConfirmReason, "github_pr_merged_trusted_allowlist_passed");
assert.equal(result.result.bridge.confirmed, true);
assert.equal(result.result.bridge.requiresConfirmation, false);
assert.equal(result.result.bridge.orchestrator.confirmed, true);
assert.equal(result.result.bridge.orchestrator.trusted.confirmed, true);
assert.equal(result.result.entry.trust, "confirmed");
assert.equal(result.result.entry.status, "active");
assert.equal(result.boundaries.callsAI, false);
assert.equal(result.boundaries.touchesTelegram, false);
assert.equal(result.boundaries.fetchesGitHub, false);
assert.equal(result.boundaries.fetchesRender, false);
assert.equal(result.boundaries.sourceSync, false);
assert.equal(result.boundaries.writesRuntimeFiles, false);
assert.equal(result.boundaries.modifiesRepository, false);
assert.equal(result.boundaries.writesConfirmedMemory, false);
assert.equal(result.boundaries.canAutoConfirmMemory, false);

console.log("smokeAiToolRegistryProjectMemoryRuntimeTrustedEvent: ok");
