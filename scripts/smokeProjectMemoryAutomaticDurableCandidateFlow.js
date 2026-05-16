// scripts/smokeProjectMemoryAutomaticDurableCandidateFlow.js
// SG 2.0 — Project Memory automatic durable candidate flow smoke.
// This smoke must stay deterministic, offline, and must not touch the real DB/network/AI/transport.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS,
  PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES,
  PROJECT_MEMORY_TYPES,
  buildProjectMemoryAutomaticDurableCandidateFlowStatus,
  createDurableProjectMemoryCandidateFromEvent,
  getProjectMemoryAutomaticDurableCandidateFlowBoundaries,
} from "../src/memory/index.js";

const status = buildProjectMemoryAutomaticDurableCandidateFlowStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_FLOW_MODES.EXPLICIT_TRUSTED_EVENT_ONLY);
assert.equal(status.canCreateDurablePendingCandidate, true);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.writesConfirmedMemory, false);
assert.equal(status.requiresExplicitDurableCandidateRequest, true);
assert.equal(status.requiresSeparateConfirmationFlow, true);

const boundaries = getProjectMemoryAutomaticDurableCandidateFlowBoundaries();
assert.equal(boundaries.explicitDurableCandidateRequestOnly, true);
assert.equal(boundaries.trustedEventsOnly, true);
assert.equal(boundaries.usesAutomaticCandidatePipeline, true);
assert.equal(boundaries.usesProjectMemoryConfirmationBoundary, true);
assert.equal(boundaries.createsDurablePendingCandidate, true);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);

let prepareCalls = 0;
const fakeConfirmation = {
  async prepareCandidateForConfirmation({ input, createdBy, projectKey, traceId, actor }) {
    prepareCalls += 1;

    assert.equal(input.type, PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS);
    assert.equal(input.trust, "candidate");
    assert.equal(input.metadata.durableWriteAttempted, true);
    assert.equal(input.metadata.confirmationAttempted, false);
    assert.equal(createdBy, "system:test");
    assert.equal(projectKey, "sg");
    assert.equal(traceId, "pmtrace_test_1");
    assert.equal(actor.role, "system");

    return {
      ok: true,
      decision: "candidate_created_for_confirmation",
      candidate: { item: input },
      entry: {
        id: "pm_test_1",
        projectKey,
        type: input.type,
        title: input.title,
        content: input.content,
        trust: "candidate",
        status: "pending_confirmation",
        traceId,
      },
      traceId,
      stored: true,
      requiresConfirmation: true,
    };
  },
};

const stored = await createDurableProjectMemoryCandidateFromEvent({
  request: {
    explicitDurableCandidateRequest: true,
    traceId: "pmtrace_test_1",
    createdBy: "system:test",
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: "PR #254 merged",
      summary: "Project Memory automatic candidate pipeline skeleton was merged.",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/254",
      projectKey: "sg",
      moduleKey: "project_memory",
      stageKey: "automatic_candidate_pipeline",
    },
  },
  actor: {
    role: "system",
    isMonarch: false,
  },
  confirmation: fakeConfirmation,
});

assert.equal(prepareCalls, 1);
assert.equal(stored.ok, true);
assert.equal(stored.decision, PROJECT_MEMORY_AUTOMATIC_DURABLE_CANDIDATE_DECISIONS.DURABLE_CANDIDATE_CREATED);
assert.equal(stored.candidatePrepared, true);
assert.equal(stored.stored, true);
assert.equal(stored.confirmed, false);
assert.equal(stored.requiresConfirmation, true);
assert.equal(stored.entry.id, "pm_test_1");
assert.equal(stored.entry.status, "pending_confirmation");
assert.equal(stored.traceId, "pmtrace_test_1");
assert.equal(stored.boundaries.confirmsCandidates, false);
assert.equal(stored.boundaries.writesConfirmedMemory, false);

const missingExplicit = await createDurableProjectMemoryCandidateFromEvent({
  request: {
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
assert.equal(missingExplicit.reason, "missing_explicit_durable_candidate_request");
assert.equal(missingExplicit.stored, false);
assert.equal(missingExplicit.confirmed, false);
assert.equal(prepareCalls, 1);

const unsupported = await createDurableProjectMemoryCandidateFromEvent({
  request: {
    explicitDurableCandidateRequest: true,
    event: {
      eventType: "raw_chat_message",
      title: "Raw chat",
      summary: "Raw chat must not become durable Project Memory candidate.",
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
assert.equal(prepareCalls, 1);

const fakeFailingConfirmation = {
  async prepareCandidateForConfirmation() {
    return {
      ok: false,
      reason: "storage_unavailable",
      stored: false,
      errors: [{ code: "storage_unavailable", message: "fake storage unavailable" }],
    };
  },
};

const storageFailed = await createDurableProjectMemoryCandidateFromEvent({
  request: {
    explicitDurableCandidateRequest: true,
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
      title: "Deploy OK",
      summary: "Deploy completed and Render logs had no errors.",
      sourceRef: "render:deploy:ok:test",
    },
  },
  confirmation: fakeFailingConfirmation,
});

assert.equal(storageFailed.ok, false);
assert.equal(storageFailed.reason, "storage_unavailable");
assert.equal(storageFailed.candidatePrepared, true);
assert.equal(storageFailed.stored, false);
assert.equal(storageFailed.confirmed, false);

console.log("smokeProjectMemoryAutomaticDurableCandidateFlow: ok");
