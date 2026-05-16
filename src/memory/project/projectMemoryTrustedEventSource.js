// src/memory/project/projectMemoryTrustedEventSource.js
// SG 2.0 — Project Memory Trusted Event Source Skeleton.
// Purpose: normalize real, already-trusted project system events before they are passed to the automatic orchestrator.
// This module does not call AI, read raw chat, touch transport, fetch GitHub/Render sources, source-sync, write DB, confirm memory, or modify repository/runtime state.

import {
  PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES,
} from "./projectMemoryAutomaticCandidatePipeline.js";

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION = 1;

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS = Object.freeze({
  GITHUB_PR_MERGED: "github_pr_merged",
});

export const PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS = Object.freeze({
  TRUSTED_EVENT_CREATED: "trusted_project_event_created",
  EVENT_REJECTED: "trusted_project_event_rejected",
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

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTags(tags = []) {
  return Array.isArray(tags)
    ? tags.map((tag) => normalizeText(tag)).filter(Boolean)
    : [];
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createRejectedResult({ reason, errors = [], warnings = [], sourceKind = "unknown" } = {}) {
  return {
    ok: false,
    version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS.EVENT_REJECTED,
    reason,
    sourceKind,
    trustedEventCreated: false,
    event: null,
    errors,
    warnings,
    boundaries: getProjectMemoryTrustedEventSourceBoundaries(),
  };
}

export function getProjectMemoryTrustedEventSourceBoundaries() {
  return {
    transportIndependent: true,
    skeletonOnly: true,
    trustedSystemEventsOnly: true,
    normalizesEventsOnly: true,
    callsAutomaticOrchestrator: false,
    createsDurableCandidate: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    writesStorage: false,
    readsStorage: false,
    callsAI: false,
    readsRawChat: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesSources: false,
    sourceSync: false,
    promptInjection: false,
    touchesTelegram: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
  };
}

export function buildProjectMemoryTrustedEventSourceStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryTrustedEventSource",
    version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES.SKELETON_ONLY,
    canCreatePrMergedTrustedEvent: true,
    canCallAutomaticOrchestrator: false,
    supportedSourceKinds: Object.values(PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS),
    supportedEventTypes: [PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED],
    boundaries: getProjectMemoryTrustedEventSourceBoundaries(),
  };
}

export function normalizeTrustedProjectEvent({ event = {} } = {}) {
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

export function createTrustedProjectEventForPrMerged({
  request = {},
  pr = {},
  projectKey = "sg",
  moduleKey = "project_memory",
  stageKey = "stage_07_memory",
  tags = [],
  metadata = {},
} = {}) {
  const safeRequest = normalizePlainObject(request);
  const safePr = normalizePlainObject(pr);
  const prNumber = normalizeNumber(safePr.number || safePr.prNumber);
  const prTitle = normalizeText(safePr.title);
  const sourceRef = normalizeText(safePr.sourceRef || safePr.htmlUrl || safePr.url);
  const repositoryFullName = normalizeText(safePr.repositoryFullName || safePr.repoFullName || safePr.repository);
  const baseBranch = normalizeText(safePr.baseBranch || safePr.baseRef || safePr.base);
  const headSha = normalizeText(safePr.headSha || safePr.mergeCommitSha || safePr.sha);
  const mergedAt = normalizeText(safePr.mergedAt || safePr.closedAt);
  const warnings = [];

  if (safeRequest.explicitTrustedEventSourceRequest !== true) {
    return createRejectedResult({
      reason: "missing_explicit_trusted_event_source_request",
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      errors: [
        createError(
          "missing_explicit_trusted_event_source_request",
          "Project Memory trusted event source requires request.explicitTrustedEventSourceRequest === true.",
        ),
      ],
    });
  }

  if (!prNumber || !prTitle || !sourceRef) {
    return createRejectedResult({
      reason: "missing_required_pr_merged_evidence",
      sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
      errors: [
        createError(
          "missing_required_pr_merged_evidence",
          "PR merged trusted event requires pr number, title, and sourceRef/url.",
          { prNumber, hasTitle: Boolean(prTitle), hasSourceRef: Boolean(sourceRef) },
        ),
      ],
    });
  }

  if (baseBranch && baseBranch !== "dev/v2-start") {
    warnings.push(
      createError(
        "unexpected_base_branch",
        "PR merged trusted event source expected dev/v2-start as the base branch.",
        { baseBranch },
      ),
    );
  }

  const event = normalizeTrustedProjectEvent({
    event: {
      eventType: PROJECT_MEMORY_AUTOMATIC_CANDIDATE_EVENT_TYPES.PR_MERGED,
      title: `PR #${prNumber} merged — ${prTitle}`,
      summary: `Merged PR #${prNumber}: ${prTitle}`,
      sourceRef,
      projectKey,
      moduleKey,
      stageKey,
      tags: [
        "trusted_event_source",
        PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
        ...normalizeTags(tags),
      ],
      metadata: {
        ...normalizePlainObject(metadata),
        trustedEventSourceVersion: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
        sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
        repositoryFullName: repositoryFullName || null,
        prNumber,
        prTitle,
        baseBranch: baseBranch || null,
        headSha: headSha || null,
        mergedAt: mergedAt || null,
        preparedBy: "ProjectMemoryTrustedEventSource.createTrustedProjectEventForPrMerged",
      },
    },
  });

  return {
    ok: true,
    version: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
    mode: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS.TRUSTED_EVENT_CREATED,
    reason: null,
    sourceKind: PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS.GITHUB_PR_MERGED,
    trustedEventCreated: true,
    event,
    requiresAutomaticOrchestrator: true,
    suggestedOrchestratorRequest: {
      explicitAutomaticMemoryRequest: true,
      autoConfirm: false,
      event,
    },
    warnings,
    errors: [],
    boundaries: getProjectMemoryTrustedEventSourceBoundaries(),
  };
}

export default {
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_VERSION,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_MODES,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_KINDS,
  PROJECT_MEMORY_TRUSTED_EVENT_SOURCE_DECISIONS,
  buildProjectMemoryTrustedEventSourceStatus,
  getProjectMemoryTrustedEventSourceBoundaries,
  normalizeTrustedProjectEvent,
  createTrustedProjectEventForPrMerged,
};
