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
assert.equal(status.canHandleRenderDeployLogsTrustedEvent, true);
assert.equal(status.canAutoConfirmWhenPolicyAllows, true);
assert.equal(status.boundaries.forcedAutoConfirmFalse, false);
assert.equal(status.boundaries.policyGatedAutoConfirm, true);
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
    assert.equal(createdBy, "smoke-test-runtime-tool");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_smoke_runtime_trusted_event_tool");
    assert.equal(actor.role, "system");

    if (input.sourceRef === "https://github.com/korzh260609-beep/garya-bot/pull/265") {
      assert.equal(input.title, "PR #265 merged — project-memory: connect trusted event source to orchestrator");
      assert.equal(input.metadata.prNumber, 265);
      assert.equal(input.metadata.confirmationAttempted, false);
      assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED);

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
          id: "pm_smoke_runtime_trusted_event_tool_pr",
          projectKey,
          title: input.title,
          trust: "candidate",
          status: "pending_confirmation",
        },
        traceId,
      };
    }

    if (input.sourceRef === "render://deploy/dep_clean") {
      assert.equal(input.title, "Render deploy checked clean — 45718465a93500fae0f53862c75d463c447c66b9");
      assert.equal(input.metadata.sourceKind, PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS);
      assert.equal(input.metadata.eventType, "deploy_ok");
      assert.equal(input.metadata.verified, true);
      assert.equal(input.metadata.deployOk, true);
      assert.equal(input.metadata.logsClean, true);
      assert.equal(input.metadata.errorCount, 0);
      assert.equal(input.metadata.confirmationAttempted, false);

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
          id: "pm_smoke_runtime_trusted_event_tool_render",
          projectKey,
          title: input.title,
          trust: "candidate",
          status: "pending_confirmation",
        },
        traceId,
      };
    }

    throw new Error(`unexpected_source_ref:${input.sourceRef}`);
  },

  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    assert.equal(entryId, "pm_smoke_runtime_trusted_event_tool_render");
    assert.equal(confirmedBy, "system");
    assert.equal(traceId, "pmtrace_smoke_runtime_trusted_event_tool");
    assert.equal(approvalRef, "render://deploy/dep_clean");

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

const prResult = await runProjectMemoryRuntimeTrustedEventTool({
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

assert.equal(prResult.ok, true);
assert.equal(prResult.dispatched, true);
assert.equal(prResult.trustedEventCreated, true);
assert.equal(prResult.candidatePrepared, true);
assert.equal(prResult.stored, true);
assert.equal(prResult.confirmed, false);
assert.equal(prResult.requiresConfirmation, true);
assert.equal(prResult.trustedEventSourceResult.ok, true);
assert.equal(prResult.trustedEventSourceResult.suggestedOrchestratorRequest.autoConfirm, false);
assert.equal(prResult.bridge.confirmed, false);
assert.equal(prResult.bridge.requiresConfirmation, true);
assert.equal(prResult.bridge.orchestrator.confirmed, false);
assert.equal(prResult.bridge.orchestrator.requiresConfirmation, true);
assert.equal(prResult.bridge.orchestrator.durable.stored, true);

const renderRejected = await runProjectMemoryRuntimeTrustedEventTool({
  request: {
    explicitRuntimeTrustedEventToolRequest: true,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
    evidence: {
      sourceKind: "render_deploy_logs",
      eventType: "deploy_check_failed",
      sourceRef: "render://deploy/dep_error",
      policy: "automatic_project_evidence_chain",
      verified: false,
      deployOk: true,
      logsClean: false,
      errorCount: 1,
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-runtime-tool",
});

assert.equal(renderRejected.ok, false);
assert.equal(renderRejected.reason, "render_evidence_not_verified_deploy_ok");
assert.equal(renderRejected.dispatched, false);
assert.equal(renderRejected.confirmed, false);

const renderConfirmed = await runProjectMemoryRuntimeTrustedEventTool({
  request: {
    explicitRuntimeTrustedEventToolRequest: true,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.RENDER_DEPLOY_LOGS,
    traceId: "pmtrace_smoke_runtime_trusted_event_tool",
    evidence: {
      sourceKind: "render_deploy_logs",
      eventType: "deploy_ok",
      sourceRef: "render://deploy/dep_clean",
      approvalRef: "render://deploy/dep_clean",
      policy: "automatic_project_evidence_chain",
      verified: true,
      deployOk: true,
      logsClean: true,
      errorCount: 0,
      logsChecked: 100,
      deployId: "dep_clean",
      commit: "45718465a93500fae0f53862c75d463c447c66b9",
      deployStatus: "live",
      collectedAt: "2026-05-16T14:10:00.000Z",
      sanitized: true,
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
  createdBy: "smoke-test-runtime-tool",
});

assert.equal(renderConfirmed.ok, true);
assert.equal(renderConfirmed.dispatched, true);
assert.equal(renderConfirmed.trustedEventCreated, true);
assert.equal(renderConfirmed.candidatePrepared, true);
assert.equal(renderConfirmed.stored, true);
assert.equal(renderConfirmed.confirmed, true);
assert.equal(renderConfirmed.requiresConfirmation, false);
assert.equal(renderConfirmed.trustedEventSourceResult.ok, true);
assert.equal(renderConfirmed.trustedEventSourceResult.suggestedOrchestratorRequest.autoConfirm, true);
assert.equal(renderConfirmed.bridge.autoConfirm, true);
assert.equal(renderConfirmed.bridge.autoConfirmReason, "render_deploy_logs_verified_clean_deploy_passed");
assert.equal(renderConfirmed.bridge.confirmed, true);
assert.equal(renderConfirmed.bridge.requiresConfirmation, false);
assert.equal(renderConfirmed.bridge.orchestrator.confirmed, true);
assert.equal(renderConfirmed.bridge.orchestrator.trusted.confirmed, true);
assert.equal(renderConfirmed.entry.trust, "confirmed");
assert.equal(renderConfirmed.entry.status, "active");
assert.equal(renderConfirmed.boundaries.forcedAutoConfirmFalse, false);
assert.equal(renderConfirmed.boundaries.policyGatedAutoConfirm, true);
assert.equal(renderConfirmed.boundaries.fetchesRender, false);
assert.equal(renderConfirmed.boundaries.writesRuntimeFiles, false);
assert.equal(renderConfirmed.boundaries.modifiesRepository, false);
assert.equal(renderConfirmed.boundaries.changesEnvironment, false);

console.log("smokeProjectMemoryRuntimeTrustedEventTool: ok");
