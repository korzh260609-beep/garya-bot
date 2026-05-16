// src/memory/project/projectMemoryAutomaticCandidatePipeline.js
// SG 2.0 — Project Memory Automatic Candidate Pipeline Skeleton.
// Purpose: convert trusted, already-verified project events into prepared Project Memory candidates.
// This module does not read/write DB, confirm candidates, call AI, touch transport, fetch sources, inject prompts, or modify repository/runtime state.

import {
  PROJECT_MEMORY_SCOPES,
  PROJECT_MEMORY_SOURCE_TYPES,
  PROJECT_MEMORY_TYPES,
} from "./projectMemoryTypes.js";
import { ProjectMemoryService } from "./projectMemoryService.js";

export const PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION = 1;

export const PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES = Object.freeze({
  PREPARE_ONLY: "prepare_only",
});

export const PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES = Object.freeze({
  PR_MERGED: "pr_merged",
  DEPLOY_OK: "deploy_ok",
  ROLLBACK_POINT_CREATED: "rollback_point_created",
  OBSERVATION_OK: "observation_ok",
  DIAGNOSTICS_OK: "diagnostics_ok",
  MONARCH_APPROVED_DECISION: "monarch_approved_decision",
});

export const PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS = Object.freeze({
  CANDIDATE_PREPARED: "automatic_candidate_prepared",
  EVENT_REJECTED: "automatic_candidate_event_rejected",
});

const EVENT_TO_MEMORY_SHAPE = Object.freeze({
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED]: {
    type: PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS,
    scope: PROJECT_MEMORY_SCOPES.REPOSITORY,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.PR,
    tag: "pr_merged",
  },
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DEPLOY_OK]: {
    type: PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS,
    scope: PROJECT_MEMORY_SCOPES.RUNTIME,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.RENDER_FACT,
    tag: "deploy_ok",
  },
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.ROLLBACK_POINT_CREATED]: {
    type: PROJECT_MEMORY_TYPES.ROLLBACK_POINT,
    scope: PROJECT_MEMORY_SCOPES.WORKFLOW,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.COMMIT,
    tag: "rollback_point",
  },
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.OBSERVATION_OK]: {
    type: PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS,
    scope: PROJECT_MEMORY_SCOPES.RUNTIME,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.RUNTIME_REPORT,
    tag: "observation_ok",
  },
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.DIAGNOSTICS_OK]: {
    type: PROJECT_MEMORY_TYPES.IMPLEMENTATION_STATUS,
    scope: PROJECT_MEMORY_SCOPES.RUNTIME,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.RUNTIME_REPORT,
    tag: "diagnostics_ok",
  },
  [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.MONARCH_APPROVED_DECISION]: {
    type: PROJECT_MEMORY_TYPES.MONARCH_APPROVED_PRINCIPLE,
    scope: PROJECT_MEMORY_SCOPES.GLOBAL_PROJECT,
    sourceType: PROJECT_MEMORY_SOURCE_TYPES.MONARCH_APPROVAL,
    tag: "monarch_approval",
  },
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeTags(tags = []) {
  return Array.isArray(tags)
    ? tags.map((tag) => normalizeText(tag)).filter(Boolean)
    : [];
}

function normalizeService(service) {
  return service || new ProjectMemoryService();
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function normalizeEvent(event = {}) {
  const safeEvent = normalizePlainObject(event);

  return {
    eventType: normalizeText(safeEvent.eventType || safeEvent.type),
    title: normalizeText(safeEvent.title),
    summary: normalizeText(safeEvent.summary || safeEvent.content),
    sourceRef: normalizeText(safeEvent.sourceRef || safeEvent.ref || safeEvent.url),
    projectKey: normalizeText(safeEvent.projectKey) || "sg",
    moduleKey: normalizeText(safeEvent.moduleKey),
    stageKey: normalizeText(safeEvent.stageKey),
    tags: normalizeTags(safeEvent.tags),
    metadata: normalizePlainObject(safeEvent.metadata),
  };
}

function buildCandidateInput(event = {}) {
  const shape = EVENT_TO_MEMORY_SHAPE[event.eventType];
  if (!shape) return null;

  return {
    type: shape.type,
    title: event.title,
    content: event.summary,
    scope: shape.scope,
    sourceType: shape.sourceType,
    sourceRef: event.sourceRef,
    tags: [
      "automatic_candidate",
      shape.tag,
      event.moduleKey,
      event.stageKey,
      ...event.tags,
    ].filter(Boolean),
    metadata: {
      ...event.metadata,
      projectKey: event.projectKey,
      moduleKey: event.moduleKey || null,
      stageKey: event.stageKey || null,
      eventType: event.eventType,
      automaticCandidatePipelineVersion: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
      preparedBy: "ProjectMemoryAutomaticCandidatePipeline.prepareCandidateFromEvent",
      durableWriteAttempted: false,
      confirmationAttempted: false,
    },
  };
}

export function getProjectMemoryAutomaticCandidatePipelineBoundaries() {
  return {
    transportIndependent: true,
    prepareOnly: true,
    trustedEventsOnly: true,
    createsDurableCandidate: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    writesStorage: false,
    readsStorage: false,
    callsAI: false,
    fetchesSources: false,
    sourceSync: false,
    autoWritesFromChat: false,
    autoWritesFromAI: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryAutomaticCandidatePipelineStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryAutomaticCandidatePipeline",
    version: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY,
    canPrepareCandidateFromTrustedEvent: true,
    canWriteStorage: false,
    canConfirmCandidate: false,
    requiresSeparateDurableWriteFlow: true,
    requiresSeparateConfirmationFlow: true,
    supportedEventTypes: Object.values(PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES),
    boundaries: getProjectMemoryAutomaticCandidatePipelineBoundaries(),
  };
}

export function prepareProjectMemoryCandidateFromEvent({ event = {}, service = null } = {}) {
  const safeEvent = normalizeEvent(event);
  const boundaries = getProjectMemoryAutomaticCandidatePipelineBoundaries();

  if (!safeEvent.eventType) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.EVENT_REJECTED,
      reason: "missing_event_type",
      candidatePrepared: false,
      durableWriteAttempted: false,
      confirmed: false,
      errors: [
        createError("missing_event_type", "Automatic Project Memory candidate requires eventType."),
      ],
      warnings: [],
      event: safeEvent,
      boundaries,
    };
  }

  const candidateInput = buildCandidateInput(safeEvent);
  if (!candidateInput) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.EVENT_REJECTED,
      reason: "unsupported_event_type",
      candidatePrepared: false,
      durableWriteAttempted: false,
      confirmed: false,
      errors: [
        createError("unsupported_event_type", "Automatic Project Memory candidate event type is not allowlisted.", {
          eventType: safeEvent.eventType,
        }),
      ],
      warnings: [],
      event: safeEvent,
      boundaries,
    };
  }

  if (!candidateInput.title || !candidateInput.content || !candidateInput.sourceRef) {
    return {
      ok: false,
      version: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
      mode: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY,
      decision: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.EVENT_REJECTED,
      reason: "missing_required_event_evidence",
      candidatePrepared: false,
      durableWriteAttempted: false,
      confirmed: false,
      errors: [
        createError(
          "missing_required_event_evidence",
          "Automatic Project Memory candidate requires title, summary/content, and sourceRef.",
        ),
      ],
      warnings: [],
      event: safeEvent,
      boundaries,
    };
  }

  const memoryService = normalizeService(service);
  const prepared = memoryService.buildCandidate(candidateInput);

  return {
    ok: prepared.ok,
    version: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
    mode: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES.PREPARE_ONLY,
    decision: prepared.ok
      ? PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.CANDIDATE_PREPARED
      : PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS.EVENT_REJECTED,
    reason: prepared.ok ? null : "candidate_validation_failed",
    candidatePrepared: prepared.ok,
    durableWriteAttempted: false,
    confirmed: false,
    requiresDurableWriteFlow: true,
    requiresConfirmation: true,
    event: safeEvent,
    candidateInput,
    candidate: prepared.item,
    validation: prepared.validation,
    warnings: prepared.warnings || [],
    errors: prepared.errors || [],
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_VERSION,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_PIPELINE_MODES,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_DECISIONS,
  buildProjectMemoryAutomaticCandidatePipelineStatus,
  getProjectMemoryAutomaticCandidatePipelineBoundaries,
  prepareProjectMemoryCandidateFromEvent,
};
