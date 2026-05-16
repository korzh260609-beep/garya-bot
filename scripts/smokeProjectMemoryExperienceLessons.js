// scripts/smokeProjectMemoryExperienceLessons.js
// SG 2.0 — Project Memory Experience Lessons smoke.
// Deterministic/offline: no DB, no GitHub, no Render, no Telegram, no AI, no live source sync.

import assert from "node:assert/strict";

import {
  buildProjectMemoryExperienceLessonsStatus,
  getProjectMemoryExperienceLessonsBoundaries,
  prepareProjectMemoryExperienceLessons,
  PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES,
  PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES,
} from "../src/memory/index.js";

const status = buildProjectMemoryExperienceLessonsStatus();
assert.equal(status.ok, true);
assert.equal(status.service, "ProjectMemoryExperienceLessons");
assert.equal(status.canPrepareLessonCandidates, true);
assert.equal(status.canCreateDurableCandidates, false);
assert.equal(status.canConfirmCandidate, false);
assert.equal(status.canWriteStorage, false);
assert.equal(status.canFetchSources, false);
assert.equal(status.callsAI, false);
assert.equal(
  status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.SUCCESSFUL_ARCHITECTURE_PATTERN),
  true,
);
assert.equal(status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.FAILED_APPROACH), true);
assert.equal(status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.RECURRING_ERROR), true);
assert.equal(status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.SAFE_ROLLBACK_LESSON), true);
assert.equal(status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.WORKFLOW_IMPROVEMENT), true);
assert.equal(status.allowedLessonTypes.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.MODULE_BOUNDARY_LESSON), true);
assert.equal(status.reviewStates.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.NEEDS_REVIEW), true);
assert.equal(status.reviewStates.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.REVIEWED), true);
assert.equal(status.reviewStates.includes(PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.CONFIRMED), true);

const boundaries = getProjectMemoryExperienceLessonsBoundaries();
assert.equal(boundaries.transportIndependent, true);
assert.equal(boundaries.providedLessonsOnly, true);
assert.equal(boundaries.reviewedOrConfirmationPathRequired, true);
assert.equal(boundaries.preservesSourceReferences, true);
assert.equal(boundaries.rawChatSummariesAllowed, false);
assert.equal(boundaries.rawLogsAllowed, false);
assert.equal(boundaries.secretsAllowed, false);
assert.equal(boundaries.overridesPillars, false);
assert.equal(boundaries.overridesMonarchDecisions, false);
assert.equal(boundaries.createsCandidateDrafts, true);
assert.equal(boundaries.createsDurableCandidates, false);
assert.equal(boundaries.confirmsCandidates, false);
assert.equal(boundaries.writesConfirmedMemory, false);
assert.equal(boundaries.readsStorage, false);
assert.equal(boundaries.writesStorage, false);
assert.equal(boundaries.callsAI, false);
assert.equal(boundaries.fetchesGitHub, false);
assert.equal(boundaries.fetchesRender, false);
assert.equal(boundaries.fetchesWeb, false);
assert.equal(boundaries.fetchesSources, false);
assert.equal(boundaries.touchesTelegram, false);
assert.equal(boundaries.readsRawChat, false);
assert.equal(boundaries.autoWritesFromChat, false);
assert.equal(boundaries.autoWritesFromAI, false);
assert.equal(boundaries.promptInjection, false);
assert.equal(boundaries.modifiesRepository, false);
assert.equal(boundaries.writesRuntimeFiles, false);
assert.equal(boundaries.changesEnvironment, false);

const invalid = prepareProjectMemoryExperienceLessons({ lessons: "not-array" });
assert.equal(invalid.ok, false);
assert.equal(invalid.reason, "invalid_lessons_input");
assert.equal(invalid.candidates.length, 0);

const prepared = prepareProjectMemoryExperienceLessons({
  lessons: [
    {
      id: "lesson_architecture_pattern",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.SUCCESSFUL_ARCHITECTURE_PATTERN,
      reviewState: PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.REVIEWED,
      title: "Small skeleton PRs reduce regression risk",
      summary: "Implementing one deterministic module boundary per PR kept Project Memory stages easy to review and rollback.",
      sourceRef: "https://github.com/korzh260609-beep/garya-bot/pull/282",
      scope: "project_memory",
    },
    {
      id: "lesson_needs_review",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.WORKFLOW_IMPROVEMENT,
      title: "Check Observation after merge",
      summary: "Post-merge Observation should be verified before marking a block closed.",
      sourceRefs: ["runtime/observation/latest/observation-journal-health-latest.json"],
    },
    {
      id: "bad_type",
      lessonType: "random_note",
      title: "Bad type",
      summary: "Rejected because lesson type is not allowlisted.",
      sourceRef: "manual://test/bad-type",
    },
    {
      id: "missing_ref",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.RECURRING_ERROR,
      title: "Missing source",
      summary: "Rejected because source reference is required.",
    },
    {
      id: "raw_chat",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.FAILED_APPROACH,
      title: "Raw chat dump rejected",
      summary: "raw chat dump must not become a lesson.",
      sourceRef: "manual://test/raw-chat",
    },
    {
      id: "secret_lesson",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.SAFE_ROLLBACK_LESSON,
      title: "Secret rejected",
      summary: "OPENAI_API_KEY=sk-example-secret-1234567890",
      sourceRef: "manual://test/secret",
    },
    {
      id: "override_pillars",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.MODULE_BOUNDARY_LESSON,
      title: "Override rejected",
      summary: "Lessons must not override pillars.",
      sourceRef: "manual://test/override",
      overridePillars: true,
    },
    {
      id: "override_monarch",
      lessonType: PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.MODULE_BOUNDARY_LESSON,
      title: "Override monarch rejected",
      summary: "Lessons must not override Monarch decisions.",
      sourceRef: "manual://test/override-monarch",
      overrideMonarchDecision: true,
    },
  ],
  options: {
    autoConfirm: true,
  },
});

assert.equal(prepared.ok, true);
assert.equal(prepared.summary.lessonsChecked, 8);
assert.equal(prepared.summary.acceptedLessons, 2);
assert.equal(prepared.summary.rejectedLessons, 6);
assert.equal(prepared.summary.candidateDraftsCreated, 2);
assert.equal(prepared.candidates.length, 2);
assert.equal(prepared.errors.length, 6);
assert.equal(prepared.errors.some((error) => error.code === "lesson_type_not_allowlisted"), true);
assert.equal(prepared.errors.some((error) => error.code === "missing_source_ref"), true);
assert.equal(prepared.errors.some((error) => error.code === "forbidden_raw_or_secret_material_rejected"), true);
assert.equal(prepared.errors.some((error) => error.code === "pillar_override_rejected"), true);
assert.equal(prepared.errors.some((error) => error.code === "monarch_decision_override_rejected"), true);
assert.equal(prepared.warnings.some((warning) => warning.code === "auto_confirm_ignored"), true);
assert.equal(prepared.warnings.some((warning) => warning.code === "lesson_requires_review"), true);

const firstCandidate = prepared.candidates[0];
assert.equal(firstCandidate.trust, "candidate");
assert.equal(firstCandidate.status, "pending_confirmation");
assert.equal(firstCandidate.reviewState, PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.REVIEWED);
assert.equal(firstCandidate.lessonType, PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES.SUCCESSFUL_ARCHITECTURE_PATTERN);
assert.deepEqual(firstCandidate.sourceRefs, ["https://github.com/korzh260609-beep/garya-bot/pull/282"]);
assert.equal(firstCandidate.sourceMetadata.importedRawChat, false);
assert.equal(firstCandidate.sourceMetadata.importedRawLogs, false);
assert.equal(firstCandidate.sourceMetadata.importedSecrets, false);
assert.equal(firstCandidate.sourceMetadata.overridesPillars, false);
assert.equal(firstCandidate.sourceMetadata.overridesMonarchDecisions, false);

assert.equal(prepared.boundaries.readsStorage, false);
assert.equal(prepared.boundaries.writesStorage, false);
assert.equal(prepared.boundaries.callsAI, false);
assert.equal(prepared.boundaries.fetchesGitHub, false);
assert.equal(prepared.boundaries.fetchesRender, false);
assert.equal(prepared.boundaries.fetchesWeb, false);
assert.equal(prepared.boundaries.fetchesSources, false);
assert.equal(prepared.boundaries.touchesTelegram, false);
assert.equal(prepared.boundaries.modifiesRepository, false);
assert.equal(prepared.boundaries.writesRuntimeFiles, false);
assert.equal(prepared.boundaries.changesEnvironment, false);
assert.equal(prepared.boundaries.writesConfirmedMemory, false);
assert.equal(prepared.boundaries.confirmsCandidates, false);

console.log("smokeProjectMemoryExperienceLessons: ok");
