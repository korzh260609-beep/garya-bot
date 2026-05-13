// scripts/smokeProjectMemoryExplicitConfirmationFlow.js
// SG 2.0 — Explicit Project Memory confirmation flow smoke.
// This smoke must stay deterministic, offline, and must not touch real DB/network/AI/Telegram/runtime files.

import assert from "node:assert/strict";
import {
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS,
  PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES,
  PROJECT_MEMORY_TRUST,
  buildProjectMemoryExplicitConfirmationFlowStatus,
  confirmExplicitProjectMemoryCandidate,
  getMemoryModuleStatus,
  getProjectMemoryExplicitConfirmationFlowBoundaries,
} from "../src/memory/index.js";

function createConfirmationRecorder({ ok = true } = {}) {
  const calls = [];

  return {
    calls,
    async confirmCandidate(input = {}) {
      calls.push(input);

      if (!ok) {
        return {
          ok: false,
          reason: "mock_confirm_failed",
          errors: [{ code: "mock_confirm_failed", message: "Mock confirm failed." }],
          warnings: [],
        };
      }

      return {
        ok: true,
        decision: "confirmed",
        entry: {
          id: input.entryId,
          trust: PROJECT_MEMORY_TRUST.CONFIRMED,
          status: "active",
          confirmedBy: input.confirmedBy,
        },
        traceId: input.traceId || "smoke-trace-explicit-confirm",
        approvalRef: input.approvalRef || null,
        trust: PROJECT_MEMORY_TRUST.CONFIRMED,
      };
    },
  };
}

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.ok, true);
assert.equal(moduleStatus.hasProjectMemoryExplicitConfirmationFlow, true);
assert.equal(moduleStatus.hasProjectMemoryManualCandidateFlow, true);
assert.equal(moduleStatus.hasTransportLogic, false);
assert.equal(moduleStatus.hasAICalls, false);
assert.equal(moduleStatus.principles.projectMemoryAutoWriteDisabled, true);
assert.equal(moduleStatus.principles.projectMemoryExplicitConfirmationOnly, true);
assert.equal(moduleStatus.principles.projectMemoryRuntimeReadConfirmedOnly, true);

const status = buildProjectMemoryExplicitConfirmationFlowStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY);
assert.equal(status.canConfirmPendingCandidate, true);
assert.equal(status.canCreateCandidate, false);
assert.equal(status.autoConfirmFromChat, false);
assert.equal(status.autoWriteFromChat, false);
assert.equal(status.autoWriteFromAI, false);
assert.equal(status.promptInjection, false);
assert.equal(status.callsAI, false);
assert.equal(status.transportConnected, false);
assert.equal(status.requiresExplicitConfirmRequest, true);

const boundaries = getProjectMemoryExplicitConfirmationFlowBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.explicitConfirmRequestOnly, true);
assert.equal(boundaries.createsCandidates, false);
assert.equal(boundaries.confirmsPendingCandidatesWhenExplicitlyCalled, true);
assert.equal(boundaries.infersFromNaturalLanguage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.injectsPromptContext, false);
assert.equal(boundaries.autoConfirmsFromChat, false);
assert.equal(boundaries.autoWritesFromChat, false);

const missingExplicit = await confirmExplicitProjectMemoryCandidate({
  request: {
    entryId: "pm_candidate_1",
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: createConfirmationRecorder(),
});
assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_confirm_request");
assert.equal(missingExplicit.confirmed, false);
assert.equal(missingExplicit.promptInjectionEnabled, false);

const missingEntryId = await confirmExplicitProjectMemoryCandidate({
  request: {
    explicitConfirmRequest: true,
    entryId: "",
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: createConfirmationRecorder(),
});
assert.equal(missingEntryId.ok, false);
assert.equal(missingEntryId.reason, "missing_entry_id");
assert.equal(missingEntryId.confirmed, false);
assert.equal(missingEntryId.promptInjectionEnabled, false);

const confirmation = createConfirmationRecorder();
const confirmed = await confirmExplicitProjectMemoryCandidate({
  request: {
    explicitConfirmRequest: true,
    entryId: "pm_candidate_1",
    traceId: "smoke-trace-explicit-confirm",
    approvalRef: "smoke:approved",
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

assert.equal(confirmed.ok, true);
assert.equal(confirmed.mode, PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_MODES.EXPLICIT_CONFIRM_ONLY);
assert.equal(confirmed.decision, PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.CONFIRMED);
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.promptInjectionEnabled, false);
assert.equal(confirmed.entry.id, "pm_candidate_1");
assert.equal(confirmed.entry.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(confirmed.entry.status, "active");
assert.equal(confirmed.trust, PROJECT_MEMORY_TRUST.CONFIRMED);
assert.equal(confirmed.traceId, "smoke-trace-explicit-confirm");
assert.equal(confirmed.approvalRef, "smoke:approved");
assert.equal(confirmation.calls.length, 1);
assert.equal(confirmation.calls[0].entryId, "pm_candidate_1");
assert.equal(confirmation.calls[0].traceId, "smoke-trace-explicit-confirm");
assert.equal(confirmation.calls[0].approvalRef, "smoke:approved");
assert.equal(confirmation.calls[0].confirmedBy, "global:monarch");

const failingConfirmation = createConfirmationRecorder({ ok: false });
const failedConfirm = await confirmExplicitProjectMemoryCandidate({
  request: {
    explicitConfirmRequest: true,
    entryId: "pm_candidate_2",
  },
  actor: { globalUserId: "global:monarch", role: "monarch", isMonarch: true },
  confirmation: failingConfirmation,
});
assert.equal(failedConfirm.ok, false);
assert.equal(failedConfirm.decision, PROJECT_MEMORY_EXPLICIT_CONFIRMATION_FLOW_DECISIONS.REQUEST_REJECTED);
assert.equal(failedConfirm.reason, "mock_confirm_failed");
assert.equal(failedConfirm.confirmed, false);
assert.equal(failedConfirm.promptInjectionEnabled, false);

console.log("smokeProjectMemoryExplicitConfirmationFlow: ok");
