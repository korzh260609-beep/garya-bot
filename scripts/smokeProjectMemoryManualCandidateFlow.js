// scripts/smokeProjectMemoryManualCandidateFlow.js
// SG 2.0 — Manual Project Memory candidate flow smoke.
// This smoke must stay deterministic, offline, and must not touch real DB/network/AI/Telegram/runtime files.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS,
  PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TRUST,
  PROJECT_MEMORY_TYPES,
  buildProjectMemoryManualCandidateFlowStatus,
  getMemoryModuleStatus,
  getProjectMemoryManualCandidateFlowBoundaries,
  prepareManualProjectMemoryCandidate,
} from "../src/memory/index.js";

function createConfirmationRecorder({ ok = true } = {}) {
  const calls = [];

  return {
    calls,
    async prepareCandidateForConfirmation(input = {}) {
      calls.push(input);

      if (!ok) {
        return {
          ok: false,
          reason: "mock_prepare_failed",
          errors: [{ code: "mock_prepare_failed", message: "Mock prepare failed." }],
          warnings: [],
        };
      }

      return {
        ok: true,
        candidate: {
          ok: true,
          item: input.input,
          validation: { ok: true },
          warnings: [],
          errors: [],
        },
        entry: {
          id: "pm_smoke_manual_candidate",
          projectKey: input.projectKey,
          trust: PROJECT_MEMORY_TRUST.CANDIDATE,
          status: "pending_confirmation",
          title: input.input.title,
          content: input.input.content,
        },
        traceId: input.traceId || "smoke-trace-manual-candidate",
        stored: true,
        requiresConfirmation: true,
      };
    },
  };
}

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasProjectMemoryManualCandidateFlow, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.principles.projectMemoryAutoWriteDisabled, true);
assert.equal(moduleStatus.principles.projectMemoryManualCandidateOnly, true);
assert.equal(moduleStatus.principles.durableProjectMemoryRequiresConfirmation, true);

const status = buildProjectMemoryManualCandidateFlowStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY);
assert.equal(status.canCreatePendingCandidate, true);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.autoWriteFromChat, false);
assert.equal(status.autoWriteFromAI, false);
assert.equal(status.promptInjection, false);
assert.equal(status.callsAI, false);
assert.equal(status.transportConnected, false);
assert.equal(status.requiresExplicitManualRequest, true);
assert.equal(status.requiresSeparateConfirmation, true);

const boundaries = getProjectMemoryManualCandidateFlowBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitManualRequestOnly, true);
assert.equal(boundaries.infersFromNaturalLanguage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.injectsPromptContext, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.writesPendingCandidatesWhenExplicitlyCalled, true);

const missingExplicit = await prepareManualProjectMemoryCandidate({
  request: {
    input: {
      title: "Should not be created",
      content: "This lacks explicitManualRequest.",
    },
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: createConfirmationRecorder(),
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_manual_request");
assert.equal(missingExplicit.stored, false);
assert.equal(missingExplicit.confirmed, false);
assert.equal(missingExplicit.promptInjectionEnabled, false);

const missingContent = await prepareManualProjectMemoryCandidate({
  request: {
    explicitManualRequest: true,
    input: {
      title: "Incomplete candidate",
      content: "",
    },
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: createConfirmationRecorder(),
});
assert.equal(missingContent.ok, false);
assert.equal(missingContent.reason, "missing_candidate_title_or_content");
assert.equal(missingContent.stored, false);
assert.equal(missingContent.confirmed, false);
assert.equal(missingContent.promptInjectionEnabled, false);

const confirmation = createConfirmationRecorder();
const prepared = await prepareManualProjectMemoryCandidate({
  request: {
    explicitManualRequest: true,
    projectKey: "sg",
    traceId: "smoke-trace-manual-candidate",
    input: {
      type: PROJECT_MEMORY_TYPES.WORKFLOW_RULE,
      title: "Manual candidate flow requires separate confirmation",
      content: "Manual Project Memory candidate flow creates pending candidates only; confirmation is handled by a separate flow.",
      sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
      sourceRef: "smoke:manual-candidate-flow",
      tags: ["project_memory", "manual_candidate"],
    },
  },
  actor: {
    globalUserId: "global:monarch",
    platform: "test",
    platformUserId: "260609",
    role: "monarch",
    isMonarch: true,
  },
  confirmation,
});

assert.equal(prepared.ok, true);
assert.equal(prepared.mode, PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_MODES.EXPLICIT_MANUAL_ONLY);
assert.equal(prepared.decision, PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.CANDIDATE_CREATED);
assert.equal(prepared.stored, true);
assert.equal(prepared.confirmed, false);
assert.equal(prepared.requiresConfirmation, true);
assert.equal(prepared.promptInjectionEnabled, false);
assert.equal(prepared.entry.trust, PROJECT_MEMORY_TRUST.CANDIDATE);
assert.equal(prepared.entry.status, "pending_confirmation");
assert.equal(prepared.projectKey, "sg");
assert.equal(prepared.traceId, "smoke-trace-manual-candidate");
assert.equal(confirmation.calls.length, 1);
assert.equal(confirmation.calls[0].projectKey, "sg");
assert.equal(confirmation.calls[0].traceId, "smoke-trace-manual-candidate");
assert.equal(confirmation.calls[0].actor.globalUserId, "global:monarch");
assert.equal(confirmation.calls[0].input.title, "Manual candidate flow requires separate confirmation");

const failingConfirmation = createConfirmationRecorder({ ok: false });
const failedPrepare = await prepareManualProjectMemoryCandidate({
  request: {
    explicitManualRequest: true,
    projectKey: "sg",
    input: {
      title: "Candidate rejected by confirmation layer",
      content: "This should surface confirmation layer failure.",
    },
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: failingConfirmation,
});
assert.equal(failedPrepare.ok, false);
assert.equal(failedPrepare.decision, PROJECT_MEMORY_MANUAL_CANDIDATE_FLOW_DECISIONS.REQUEST_REJECTED);
assert.equal(failedPrepare.reason, "mock_prepare_failed");
assert.equal(failedPrepare.stored, false);
assert.equal(failedPrepare.confirmed, false);
assert.equal(failedPrepare.promptInjectionEnabled, false);

console.log("smokeProjectMemoryManualCandidateFlow: ok");
