// scripts/smokeProjectMemoryAutomaticOrchestrator.js
// SG 2.0 — Project Memory automatic orchestrator smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network/AI/transport.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS,
  PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES,
  buildProjectMemoryAutomaticOrchestratorStatus,
  getProjectMemoryAutomaticOrchestratorBoundaries,
  processProjectMemoryAutomaticEvent,
} from "../src/memory/index.js";

const status = buildProjectMemoryAutomaticOrchestratorStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_MODES.EXPLICIT_TRUSTED_EVENT_ONLY);
assert.equal(status.canCreateDurablePendingCandidate, true);
assert.equal(status.canConfirmWithTrustedEvidence, true);
assert.equal(status.canReuseDuplicateConfirmedEntryByTraceId, true);
assert.equal(status.requiresExplicitAutomaticMemoryRequest, true);
assert.equal(status.requiresVerifiedTrustedEvidenceForConfirmation, true);

const boundaries = getProjectMemoryAutomaticOrchestratorBoundaries();
assert.equal(boundaries.explicitAutomaticMemoryRequestOnly, true);
assert.equal(boundaries.trustedEventsOnly, true);
assert.equal(boundaries.canCreateDurablePendingCandidate, true);
assert.equal(boundaries.canConfirmWhenAutoConfirmTrueAndEvidenceVerified, true);
assert.equal(boundaries.confirmationRequiresTrustedEvidence, true);
assert.equal(boundaries.usesDurableCandidateFlow, true);
assert.equal(boundaries.usesTrustedConfirmationFlow, true);
assert.equal(boundaries.duplicateTraceGuard, true);
assert.equal(boundaries.duplicateConfirmedEntryIsIdempotent, true);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);

let prepareCalls = 0;
let confirmCalls = 0;
const entriesByTraceId = new Map();

const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    const existing = entriesByTraceId.get(traceId);
    if (existing) {
      return {
        ok: true,
        decision: "candidate_created_for_confirmation",
        candidate: { item: input },
        entry: existing,
        traceId,
        stored: true,
        requiresConfirmation: existing.trust !== "confirmed",
        duplicateGuard: {
          matched: true,
          decision: "existing_entry_returned",
          reason: "trace_id_already_recorded",
          traceId,
          entryId: existing.id,
          trust: existing.trust,
          status: existing.status,
        },
      };
    }

    prepareCalls += 1;
    assert.equal(input.trust, "candidate");
    assert.equal(input.metadata.durableWriteAttempted, true);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.ok(["system:test", "system"].includes(createdBy));
    assert.equal(projectKey, "sg");
    assert.equal(actor.role, "system");

    const entry = {
      id: `pm_auto_${prepareCalls}`,
      projectKey,
      type: input.type,
      title: input.title,
      content: input.content,
      trust: "candidate",
      status: "pending_confirmation",
      traceId,
    };
    entriesByTraceId.set(traceId, entry);

    return {
      ok: true,
      decision: "candidate_created_for_confirmation",
      candidate: { item: input },
      entry,
      traceId,
      stored: true,
      requiresConfirmation: true,
      duplicateGuard: {
        matched: false,
        decision: "new_entry_created",
        traceId,
        entryId: entry.id,
      },
    };
  },

  async confirmCandidate({ entryId, confirmedBy, traceId, approvalRef }) {
    confirmCalls += 1;
    assert.equal(confirmedBy, "system:test");
    assert.ok(entryId.startsWith("pm_auto_"));
    assert.equal(approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/256");

    const existing = entriesByTraceId.get(traceId);
    const confirmedEntry = {
      ...(existing || {}),
      id: entryId,
      trust: "confirmed",
      status: "active",
      traceId,
    };
    entriesByTraceId.set(traceId, confirmedEntry);

    return {
      ok: true,
      entry: confirmedEntry,
      trust: "confirmed",
      traceId,
      approvalRef,
    };
  },
};

const candidateOnly = await processProjectMemoryAutomaticEvent({
  request: {
    explicitAutomaticMemoryRequest: true,
    autoConfirm: false,
    traceId: "pmtrace_auto_1",
    createdBy: "system:test",
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: "PR #256 merged",
      summary: "Trusted confirmation flow was merged into dev/v2-start.",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/256",
      projectKey: "sg",
    },
  },
  actor: {
    role: "system",
  },
  confirmation: fakeConfirmation,
});

assert.equal(candidateOnly.ok, true);
assert.equal(candidateOnly.decision, PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.CANDIDATE_CREATED);
assert.equal(candidateOnly.candidatePrepared, true);
assert.equal(candidateOnly.stored, true);
assert.equal(candidateOnly.confirmed, false);
assert.equal(candidateOnly.requiresConfirmation, true);
assert.equal(candidateOnly.entry.status, "pending_confirmation");
assert.equal(candidateOnly.duplicateGuard.matched, false);
assert.equal(prepareCalls, 1);
assert.equal(confirmCalls, 0);

const confirmed = await processProjectMemoryAutomaticEvent({
  request: {
    explicitAutomaticMemoryRequest: true,
    autoConfirm: true,
    traceId: "pmtrace_auto_2",
    createdBy: "system:test",
    confirmedBy: "system:test",
    evidence: {
      verified: true,
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/256",
    },
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: "PR #256 deployed",
      summary: "Trusted confirmation flow deployed with clean logs.",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/256",
      projectKey: "sg",
    },
  },
  actor: {
    role: "system",
  },
  confirmation: fakeConfirmation,
});

assert.equal(confirmed.ok, true);
assert.equal(confirmed.decision, PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.CONFIRMED);
assert.equal(confirmed.candidatePrepared, true);
assert.equal(confirmed.stored, true);
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.entry.trust, "confirmed");
assert.equal(confirmed.approvalRef, "https://github.com/korzh260609-beep/garya-bot/pull/256");
assert.equal(confirmed.duplicateGuard.matched, false);
assert.equal(prepareCalls, 2);
assert.equal(confirmCalls, 1);

const duplicateConfirmed = await processProjectMemoryAutomaticEvent({
  request: {
    explicitAutomaticMemoryRequest: true,
    autoConfirm: true,
    traceId: "pmtrace_auto_2",
    createdBy: "system:test",
    confirmedBy: "system:test",
    evidence: {
      verified: true,
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/256",
    },
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: "PR #256 deployed duplicate",
      summary: "Duplicate traceId should reuse confirmed entry.",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/256",
      projectKey: "sg",
    },
  },
  actor: {
    role: "system",
  },
  confirmation: fakeConfirmation,
});

assert.equal(duplicateConfirmed.ok, true);
assert.equal(duplicateConfirmed.decision, PROJECT_MEMORY_AUTOMATIC_ORCHESTRATOR_DECISIONS.DUPLICATE_CONFIRMED_ENTRY_REUSED);
assert.equal(duplicateConfirmed.candidatePrepared, true);
assert.equal(duplicateConfirmed.stored, true);
assert.equal(duplicateConfirmed.confirmed, true);
assert.equal(duplicateConfirmed.requiresConfirmation, false);
assert.equal(duplicateConfirmed.entry.id, confirmed.entry.id);
assert.equal(duplicateConfirmed.duplicateGuard.matched, true);
assert.equal(duplicateConfirmed.trusted, null);
assert.equal(prepareCalls, 2);
assert.equal(confirmCalls, 1);

const missingExplicit = await processProjectMemoryAutomaticEvent({
  request: {
    autoConfirm: true,
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: "Missing explicit flag",
      summary: "This must be rejected.",
      sourceRef: "internal:test",
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(missingExplicit.ok, false);
assert.equal(missingExplicit.reason, "missing_explicit_automatic_memory_request");
assert.equal(missingExplicit.stored, false);
assert.equal(missingExplicit.confirmed, false);
assert.equal(prepareCalls, 2);
assert.equal(confirmCalls, 1);

const unverifiedConfirm = await processProjectMemoryAutomaticEvent({
  request: {
    explicitAutomaticMemoryRequest: true,
    autoConfirm: true,
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
      title: "Deploy OK",
      summary: "Deploy was OK but evidence is not verified.",
      sourceRef: "render:deploy:ok:test",
    },
    evidence: {
      verified: false,
      sourceRef: "render:deploy:ok:test",
    },
  },
  actor: { role: "system" },
  confirmation: fakeConfirmation,
});

assert.equal(unverifiedConfirm.ok, false);
assert.equal(unverifiedConfirm.reason, "trusted_evidence_rejected");
assert.equal(unverifiedConfirm.candidatePrepared, true);
assert.equal(unverifiedConfirm.stored, true);
assert.equal(unverifiedConfirm.confirmed, false);
assert.equal(prepareCalls, 3);
assert.equal(confirmCalls, 1);

const unsupported = await processProjectMemoryAutomaticEvent({
  request: {
    explicitAutomaticMemoryRequest: true,
    autoConfirm: true,
    event: {
      eventType: "raw_chat_message",
      title: "Raw chat",
      summary: "Raw chat must not become automatic Project Memory.",
      sourceRef: "chat:raw",
    },
    evidence: {
      verified: true,
      sourceRef: "chat:raw",
    },
  },
  confirmation: fakeConfirmation,
});

assert.equal(unsupported.ok, false);
assert.equal(unsupported.reason, "unsupported_event_type");
assert.equal(unsupported.candidatePrepared, false);
assert.equal(unsupported.stored, false);
assert.equal(unsupported.confirmed, false);
assert.equal(prepareCalls, 3);
assert.equal(confirmCalls, 1);

console.log("smokeProjectMemoryAutomaticOrchestrator: ok");
