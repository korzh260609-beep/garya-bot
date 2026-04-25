// src/projectExperience/projectExperienceTypes.js
// ============================================================================
// STAGE C.1 — Project Experience Engine types/skeleton
// Purpose:
// - define stable shapes for project evidence, analysis and memory writes
// - separate raw repo facts from inferred meaning and confirmed knowledge
// - keep future GitHub/Render/DB integrations replaceable
// IMPORTANT:
// - NO side effects
// - NO DB writes
// - NO GitHub calls here
// ============================================================================

export const PROJECT_EXPERIENCE_LAYERS = Object.freeze({
  RAW_ARCHIVE: "raw_archive",
  TOPIC_DIGEST: "topic_digest",
  CONFIRMED: "confirmed",
});

export const PROJECT_EXPERIENCE_EVIDENCE_TYPES = Object.freeze({
  COMMIT: "commit",
  FILE_CHANGE: "file_change",
  WORKFLOW_ENTRY: "workflow_entry",
  DECISION_ENTRY: "decision_entry",
  MANUAL_CLAIM: "manual_claim",
  TEST_RESULT: "test_result",
});

export const PROJECT_EXPERIENCE_CONFIDENCE = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNKNOWN: "unknown",
});

export const PROJECT_EXPERIENCE_STATUSES = Object.freeze({
  VERIFIED: "verified",
  PARTIAL: "partial",
  BLOCKED: "blocked",
  UNKNOWN: "unknown",
});

export function createProjectEvidence({
  type,
  source = null,
  ref = null,
  title = null,
  summary = "",
  details = {},
  confidence = PROJECT_EXPERIENCE_CONFIDENCE.UNKNOWN,
} = {}) {
  return {
    type,
    source,
    ref,
    title,
    summary,
    details: details && typeof details === "object" && !Array.isArray(details) ? details : {},
    confidence,
  };
}

export function createProjectExperienceSnapshot({
  projectKey = "garya-bot",
  repository = "korzh260609-beep/garya-bot",
  ref = "main",
  stageKey = null,
  evidences = [],
  status = PROJECT_EXPERIENCE_STATUSES.UNKNOWN,
  summary = "",
  risks = [],
  nextSteps = [],
  meta = {},
} = {}) {
  return {
    projectKey,
    repository,
    ref,
    stageKey,
    evidences: Array.isArray(evidences) ? evidences : [],
    status,
    summary,
    risks: Array.isArray(risks) ? risks : [],
    nextSteps: Array.isArray(nextSteps) ? nextSteps : [],
    meta: meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {},
  };
}

export default {
  PROJECT_EXPERIENCE_LAYERS,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
  PROJECT_EXPERIENCE_STATUSES,
  createProjectEvidence,
  createProjectExperienceSnapshot,
};
