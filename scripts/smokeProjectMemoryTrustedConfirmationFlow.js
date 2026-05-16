// scripts/smokeProjectMemoryTrustedConfirmationFlow.js
// SG 2.0 — Project Memory trusted confirmation flow smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network/AI/transport.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS,
  PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES,
  buildProjectMemoryTrustedConfirmationFlowStatus,
  confirmTrustedProjectMemoryCandidate,
  getProjectMemoryTrustedConfirmationFlowBoundaries,
} from "../src/memory/index.js";

const status = buildProjectMemoryTrustedConfirmationFlowStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_TRUSTED_CONFIRMATION_FLOW_MODES.EXPLICIT_TRUSTED_CONFIRM_ONLY);
assert.equal(status.canConfirmPendingCandidate, true);
assert.equal(status.canCreateCandidate, false);
assert.equal(status.requiresExplicitTrustedConfirmRequest, true);
assert.equal(status.requiresVerifiedTrustedEvidence, true);
assert.ok(status.supportedEventTypes.includes(PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED));

const boundaries = getProjectMemoryTrustedConfirmationFlowBoundaries();
assert.equal(boundaries.explicitTrustedConfirmRequestOnly, true);
assert.equal(boundaries.trustedEventsOnly, true);
assert.equal(boundaries.allowlistedEvidenceOnly, true);
assert.equal(boundaries.createsCandidates, false);
assert.equal(boundaries.confirmsPendingCandidatesWhenExplicitTrustedEvidence, true);
assert.equal(boundaries.writesConfirmedMemoryThroughConfirmationBoundaryOnly, true);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.autoConfirmsFromChat, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);

let confirmCalls = 0;
const fakeConfirmation = {
  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    confirmCalls += 1;
    assert.equal(entryId, "pm_test_1");
    assert.equal(confirmedBy, "system:test");
    assert.equal(traceId, "pmtrace_test_confirm_1");
    assert.equal(approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/255");

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

const confirmed = await confirmTrustedProjectMemoryCandidate({
  request: {
    explicitTrustedConfirmRequest: true,
    entryId: "pm_test_1",
    traceId: "pmtrace_test_confirm_1",
    confirmedBy: "system:test",
    evidence: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/255",
      verified: true,
    },
  },
  actor: {
    role: "system",
  },
  confirmation: fakeConfirmation,
});

assert.equal(confirmCalls, 1);
assert.equal(confirmed.ok, true);
assert.equal(confirmed.decision, PROJECT_MEMORY_TRUSTED_CONFIRMATION_DECISIONS.CONFIRMED);
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.entry.trust, "confirmed");
assert.equal(confirmed.traceId, "pmtrace_test_confirm_1");
assert.equal(confirmed.approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/255");
assert.equal(confirmed.boundaries.createsCandidates, false);
assert.equal(confirmed.boundaries.callsAI, false);

const missingExplicit = await confirmTrustedProjectMemoryCandidate({
  request: {
    entryId: "pm_test_1",
    evidence: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/255",
      verified: true,
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_trusted_confirm_request");
assert.equal(missingExplicit.confirmed, false);
assert.equal(confirmCalls, 1);

const unsupported = await confirmTrustedProjectMemoryCandidate({
  request: {
    explicitTrustedConfirmRequest: true,
    entryId: "pm_test_1",
    evidence: {
      eventType: "raw_chat_message",
      sourceRef: "chat:raw",
      verified: true,
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(unsupported.ok, false);
assert.equal(unsupported.reason, "trusted_evidence_rejected");
assert.ok(unsupported.errors.some((error) => error.code === "unsupported_trusted_event_type"));
assert.equal(unsupported.confirmed, false);
assert.equal(confirmCalls, 1);

const unverified = await confirmTrustedProjectMemoryCandidate({
  request: {
    explicitTrustedConfirmRequest: true,
    entryId: "pm_test_1",
    evidence: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
      sourceRef: "render:deploy:ok:test",
      verified: false,
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(unverified.ok, false);
assert.equal(unverified.reason, "trusted_evidence_rejected");
assert.ok(unverified.errors.some((error) => error.code === "trusted_evidence_not_verified"));
assert.equal(unverified.confirmed, false);
assert.equal(confirmCalls, 1);

const missingSource = await confirmTrustedProjectMemoryCandidate({
  request: {
    explicitTrustedConfirmRequest: true,
    entryId: "pm_test_1",
    evidence: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DIAGNOSTICS_OK,
      verified: true,
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(missingSource.ok, false);
assert.equal(missingSource.reason, "trusted_evidence_rejected");
assert.ok(missingSource.errors.some((error) => error.code === "missing_trusted_source_ref"));
assert.equal(missingSource.confirmed, false);
assert.equal(confirmCalls, 1);

const fakeFailingConfirmation = {
  async confirmCandidate() {
    return {
      ok: false,
      reason: "candidate_not_found_or_not_pending",
    };
  },
};

const confirmFailed = await confirmTrustedProjectMemoryCandidate({
  request: {
    explicitTrustedConfirmRequest: true,
    entryId: "pm_missing",
    evidence: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.OBSERVATION_OK,
      sourceRef: "runtime/observation/latest/diagnostics-latest.json",
      verified: true,
    },
  },
  confirmation: fakeFailingConfirmation,
});

assert.equal(confirmFailed.ok, false);
assert.equal(confirmFailed.reason, "candidate_not_found_or_not_pending");
assert.equal(confirmFailed.confirmed, false);

console.log("smokeProjectMemoryTrustedConfirmationFlow: ok");
