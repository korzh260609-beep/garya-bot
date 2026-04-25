// src/projectExperience/ProjectExperienceMemorySchema.js
// ============================================================================
// STAGE C.3B — Project Experience Memory Schema (SKELETON)
// Purpose:
// - define structured memory records for SG project experience
// - prevent Project Memory from becoming an unstructured pile of notes
// - keep chronology, evidence, decisions, modules and revisions connected
// IMPORTANT:
// - NO DB writes
// - NO migrations here
// - NO Project Memory writes
// - schema contract only
// ============================================================================

export const EXPERIENCE_MEMORY_RECORD_TYPES = Object.freeze({
  TIMELINE_EVENT: "timeline_event",
  STAGE_STATE: "stage_state",
  MODULE_STATE: "module_state",
  DECISION_RECORD: "decision_record",
  EVIDENCE_RECORD: "evidence_record",
  RISK_RECORD: "risk_record",
  REVISION_RECORD: "revision_record",
  LESSON_RECORD: "lesson_record",
});

export const EXPERIENCE_MEMORY_SOURCE_TYPES = Object.freeze({
  GITHUB_COMMIT: "github_commit",
  GITHUB_DIFF: "github_diff",
  PILLAR_WORKFLOW: "pillar_workflow",
  PILLAR_ROADMAP: "pillar_roadmap",
  PILLAR_DECISION: "pillar_decision",
  PROJECT_MEMORY: "project_memory",
  MONARCH_CLAIM: "monarch_claim",
  SYSTEM_ANALYSIS: "system_analysis",
});

export const EXPERIENCE_MEMORY_TRUST_LEVELS = Object.freeze({
  VERIFIED: "verified",
  INFERRED: "inferred",
  CLAIMED: "claimed",
  UNKNOWN: "unknown",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeMeta(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function createExperienceMemoryRecord({
  recordType,
  projectKey = "garya-bot",
  stageKey = null,
  moduleKey = null,
  title = null,
  summary = "",
  chronologyTime = null,
  sourceType = EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
  sourceRef = null,
  trustLevel = EXPERIENCE_MEMORY_TRUST_LEVELS.UNKNOWN,
  evidenceRefs = [],
  decisionRefs = [],
  relatedFiles = [],
  risks = [],
  nextSteps = [],
  oldValue = null,
  newValue = null,
  reason = null,
  meta = {},
} = {}) {
  return {
    recordType: safeText(recordType),
    projectKey: safeText(projectKey) || "garya-bot",
    stageKey: safeText(stageKey) || null,
    moduleKey: safeText(moduleKey) || null,
    title: safeText(title) || null,
    summary: safeText(summary),
    chronologyTime: safeText(chronologyTime) || null,
    sourceType: safeText(sourceType) || EXPERIENCE_MEMORY_SOURCE_TYPES.SYSTEM_ANALYSIS,
    sourceRef: safeText(sourceRef) || null,
    trustLevel: safeText(trustLevel) || EXPERIENCE_MEMORY_TRUST_LEVELS.UNKNOWN,
    evidenceRefs: ensureArray(evidenceRefs).map(safeText).filter(Boolean),
    decisionRefs: ensureArray(decisionRefs).map(safeText).filter(Boolean),
    relatedFiles: ensureArray(relatedFiles).map(safeText).filter(Boolean),
    risks: ensureArray(risks).map(safeText).filter(Boolean),
    nextSteps: ensureArray(nextSteps).map(safeText).filter(Boolean),
    oldValue,
    newValue,
    reason: safeText(reason) || null,
    meta: normalizeMeta(meta),
  };
}

export function createStageStateRecord(input = {}) {
  return createExperienceMemoryRecord({
    ...input,
    recordType: EXPERIENCE_MEMORY_RECORD_TYPES.STAGE_STATE,
  });
}

export function createTimelineEventRecord(input = {}) {
  return createExperienceMemoryRecord({
    ...input,
    recordType: EXPERIENCE_MEMORY_RECORD_TYPES.TIMELINE_EVENT,
  });
}

export function createDecisionRecord(input = {}) {
  return createExperienceMemoryRecord({
    ...input,
    recordType: EXPERIENCE_MEMORY_RECORD_TYPES.DECISION_RECORD,
  });
}

export function createRevisionRecord(input = {}) {
  return createExperienceMemoryRecord({
    ...input,
    recordType: EXPERIENCE_MEMORY_RECORD_TYPES.REVISION_RECORD,
  });
}

export default {
  EXPERIENCE_MEMORY_RECORD_TYPES,
  EXPERIENCE_MEMORY_SOURCE_TYPES,
  EXPERIENCE_MEMORY_TRUST_LEVELS,
  createExperienceMemoryRecord,
  createStageStateRecord,
  createTimelineEventRecord,
  createDecisionRecord,
  createRevisionRecord,
};
