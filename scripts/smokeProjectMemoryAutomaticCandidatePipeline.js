// scripts/smokeProjectMemoryAutomaticCandidatePipeline.js
// SG 2.0 — Project Memory automatic candidate pipeline smoke.
// This smoke must stay deterministic, offline, prepare-only, and must not touch DB/network/AI/transport.

import assert from "node:assert/strict";

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TYPES,
  buildProjectMemoryAutomaticCandidatePipelineStatus,
  getMemoryModuleStatus,
  getProjectMemoryAutomaticCandidatePipelineBoundaries,
  prepareProjectMemoryCandidateFromEvent,
} from "../src/memory/index.js";

const status = buildProjectMemoryAutomaticCandidatePipelineStatus();
assert.equal(status.ok, true);
assert.equal(status.mode, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY);
assert.equal(status.canPrepareCandidateFromTrustedEvent, true);
assert.equal(status.canWriteStorage, false);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.requiresSeparateDurableWriteFlow, true);
assert.equal(status.requiresSeparateConfirmationFlow, true);
assert.ok(status.supportedEventTypes.includes(PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED));

const moduleStatus = getMemoryModuleStatus();
assert.equal(moduleStatus.hasProjectMemoryAutomaticCandidatePipeline, true);
assert.equal(moduleStatus.principles.projectMemoryAutomaticCandidatePrepareOnly, true);

const boundaries = getProjectMemoryAutomaticCandidatePipelineBoundaries();
assert.equal(boundaries.prepareOnly, true);
assert.equal(boundaries.createsDurableCandidate, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.sourceSync, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);

const preparedPr = prepareProjectMemoryCandidateFromEvent({
  event: {
    eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
    title: "PR #253 merged",
    summary: "Structured message understanding intent skeleton was merged into dev/v2-start.",
    sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/253",
    moduleKey: "project_memory",
    stageKey: "automatic_candidate_pipeline",
    tags: ["message_understanding", "structured_intent"],
    metadata: {
      prNumber: 253,
      mergeCommit: "4c11465b49ad4c05d2d8c263b6c0638516caebf1",
    },
  },
});

assert.equal(preparedPr.ok, true);
assert.equal(preparedPr.decision, PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.CANDIDATE_PREPARED);
assert.equal(preparedPr.candidatePrepared, true);
assert.equal(preparedPr.durableWriteAttempted, false);
assert.equal(preparedPr.confirmed, false);
assert.equal(preparedPr.requiresDurableWriteFlow, true);
assert.equal(preparedPr.requiresConfirmation, true);
assert.equal(preparedPr.candidate.type, PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS);
assert.equal(preparedPr.candidate.sourceType, PROJECT_MEMORY_SOURCE_TYPES.PR);
assert.equal(preparedPr.candidate.trust, "candidate");
assert.ok(preparedPr.candidate.tags.includes("automatic_candidate"));
assert.ok(preparedPr.candidate.tags.includes("pr_merged"));
assert.equal(preparedPr.candidate.metadata.durableWriteAttempted, false);
assert.equal(preparedPr.candidate.metadata.confirmationAttempted, false);
assert.equal(preparedPr.boundaries.writesStorage, false);
assert.equal(preparedPr.boundaries.callsAI, false);

const preparedRollback = prepareProjectMemoryCandidateFromEvent({
  event: {
    eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.ROLLBACK_POINT_CREATED,
    title: "Rollback point created after PR #253 deploy",
    summary: "Rollback branch rollback/2026-05-16-pr253-post-deploy was created after successful deploy and clean Render logs.",
    sourceRef: "rollback/2026-05-16-pr253-post-deploy",
  },
});

assert.equal(preparedRollback.ok, true);
assert.equal(preparedRollback.candidate.type, PROJECT_MEMORY_TYPES.ROLLBACK_POINT);
assert.ok(preparedRollback.candidate.tags.includes("rollback_point"));

const missingType = prepareProjectMemoryCandidateFromEvent({
  event: {
    title: "No type",
    summary: "This event must be rejected.",
    sourceRef: "internal:test",
  },
});

assert.equal(missingType.ok, false);
assert.equal(missingType.reason, "missing_event_type");
assert.equal(missingType.candidatePrepared, false);
assert.equal(missingType.durableWriteAttempted, false);

const unsupported = prepareProjectMemoryCandidateFromEvent({
  event: {
    eventType: "raw_chat_message",
    title: "Raw chat",
    summary: "Raw chat must not become automatic Project Memory.",
    sourceRef: "chat:raw",
  },
});

assert.equal(unsupported.ok, false);
assert.equal(unsupported.reason, "unsupported_event_type");
assert.equal(unsupported.candidatePrepared, false);

const missingEvidence = prepareProjectMemoryCandidateFromEvent({
  event: {
    eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK,
    title: "Deploy OK",
    summary: "Deploy was reported as OK but sourceRef is missing.",
  },
});

assert.equal(missingEvidence.ok, false);
assert.equal(missingEvidence.reason, "missing_required_event_evidence");
assert.equal(missingEvidence.candidatePrepared, false);

const secretBlocked = prepareProjectMemoryCandidateFromEvent({
  event: {
    eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.MONARCH_APPROVED_DECISION,
    title: "Secret must be blocked",
    summary: "Never store OPENAI_API_KEY sk-testSecretValue123456 in Project Memory.",
    sourceRef: "monarch:test",
  },
});

assert.equal(secretBlocked.ok, false);
assert.equal(secretBlocked.reason, "candidate_validation_failed");
assert.ok(secretBlocked.errors.some((error) => error.code === "contains_secret"));
assert.equal(secretBlocked.durableWriteAttempted, false);
assert.equal(secretBlocked.confirmed, false);

console.log("smokeProjectMemoryAutomaticCandidatePipeline: ok");
