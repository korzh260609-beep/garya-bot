// src/memory/project/projectMemoryConflictStaleDetector.js
// SG 2.0 — Project Memory Conflict/Stale Detector Skeleton.
// Purpose: label provided Project Memory entries with deterministic conflict/stale signals.
// This module uses provided entries and provided verified evidence only.
// Do not add DB access, Telegram logic, AI calls, source fetching, source sync,
// runtime file writes, repository mutation, env changes, or prompt injection here.

export const PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION = 1;

export const PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_DECISIONS = Object.freeze({
  ANALYSIS_COMPLETED: "conflict_stale_analysis_completed",
  REQUEST_REJECTED: "conflict_stale_request_rejected",
});

export const PROJECT_MEMORY_CONFLICT_STALE_LABELS = Object.freeze({
  STALE: "stale",
  CONFLICTED: "conflicted",
  DUPLICATE: "duplicate",
  SUPERSEDED: "superseded",
  ARCHIVED: "archived",
  CONTRADICTED_BY_VERIFIED_EVIDENCE: "contradicted_by_verified_evidence",
});

const ALLOWED_CONTRADICTION_SOURCE_TYPES = new Set([
  "pillar",
  "repository",
  "runtime",
  "db_diagnostics",
]);

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeComparisonText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEntries(entries) {
  return Array.isArray(entries) ? entries.map(normalizePlainObject) : null;
}

function normalizeVerifiedEvidence(verifiedEvidence) {
  return Array.isArray(verifiedEvidence)
    ? verifiedEvidence.map(normalizePlainObject)
    : [];
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createReason(code, message, extra = {}) {
  return { code, message, ...extra };
}

function getEntryId(entry = {}, fallbackIndex = 0) {
  return normalizeText(entry.id) || `entry_${fallbackIndex}`;
}

function getEntryTitle(entry = {}) {
  return normalizeText(entry.title);
}

function getEntryMetadata(entry = {}) {
  return normalizePlainObject(entry.metadata);
}

function getEntryStatus(entry = {}) {
  return normalizeComparisonText(entry.status);
}

function pushLabel(labelMap, entry, entryIndex, label, reason, evidence = null) {
  const entryId = getEntryId(entry, entryIndex);

  if (!labelMap.has(entryId)) {
    labelMap.set(entryId, {
      entryId,
      title: getEntryTitle(entry),
      labels: [],
      reasons: [],
      evidence: [],
    });
  }

  const item = labelMap.get(entryId);
  if (!item.labels.includes(label)) item.labels.push(label);
  if (reason) item.reasons.push(reason);
  if (evidence) item.evidence.push(evidence);
}

function buildDuplicateKey(entry = {}) {
  const projectKey = normalizeComparisonText(entry.projectKey || entry.project_key);
  const type = normalizeComparisonText(entry.type || entry.itemType || entry.item_type);
  const title = normalizeComparisonText(entry.title);
  const sourceRef = normalizeComparisonText(entry.sourceRef || entry.source_ref);

  if (!projectKey || !type || !title || !sourceRef) return null;
  return [projectKey, type, title, sourceRef].join("::");
}

function buildDuplicateGroups(entries = []) {
  const groups = new Map();

  entries.forEach((entry, index) => {
    const key = buildDuplicateKey(entry);
    if (!key) return;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        entries: [],
      });
    }

    groups.get(key).entries.push({
      entryId: getEntryId(entry, index),
      title: getEntryTitle(entry),
      index,
    });
  });

  return [...groups.values()].filter((group) => group.entries.length > 1);
}

function buildContradictionEvidenceByEntryId(verifiedEvidence = []) {
  const map = new Map();

  verifiedEvidence.forEach((evidence) => {
    const kind = normalizeComparisonText(evidence.kind);
    const entryId = normalizeText(evidence.entryId || evidence.entry_id);
    const sourceType = normalizeComparisonText(evidence.sourceType || evidence.source_type);
    const sourceRef = normalizeText(evidence.sourceRef || evidence.source_ref);
    const reason = normalizeText(evidence.reason);

    if (kind !== "contradiction") return;
    if (!entryId) return;
    if (!ALLOWED_CONTRADICTION_SOURCE_TYPES.has(sourceType)) return;
    if (!sourceRef || !reason) return;

    const normalizedEvidence = {
      kind: "contradiction",
      entryId,
      sourceType,
      sourceRef,
      reason,
    };

    if (!map.has(entryId)) map.set(entryId, []);
    map.get(entryId).push(normalizedEvidence);
  });

  return map;
}

export function getProjectMemoryConflictStaleDetectorBoundaries() {
  return {
    transportIndependent: true,
    providedEntriesOnly: true,
    providedEvidenceOnly: true,
    readsStorage: false,
    writesStorage: false,
    createsCandidates: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    callsAI: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesSources: false,
    sourceSync: false,
    touchesTelegram: false,
    readsRawChat: false,
    autoWritesFromChat: false,
    autoWritesFromAI: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
    changesEnvironment: false,
  };
}

export function buildProjectMemoryConflictStaleDetectorStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryConflictStaleDetector",
    version: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION,
    mode: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES.SKELETON_ONLY,
    canDetectStaleEntries: true,
    canDetectConflictedEntries: true,
    canDetectDuplicateEntries: true,
    canDetectSupersededEntries: true,
    canDetectArchivedEntries: true,
    canUseProvidedVerifiedEvidence: true,
    canFetchEvidence: false,
    canWriteStorage: false,
    canConfirmCandidate: false,
    callsAI: false,
    boundaries: getProjectMemoryConflictStaleDetectorBoundaries(),
  };
}

export function detectProjectMemoryConflictsAndStaleness({
  entries = [],
  verifiedEvidence = [],
  options = {},
} = {}) {
  const normalizedEntries = normalizeEntries(entries);
  const safeEvidence = normalizeVerifiedEvidence(verifiedEvidence);
  const safeOptions = normalizePlainObject(options);
  const boundaries = getProjectMemoryConflictStaleDetectorBoundaries();

  if (!normalizedEntries) {
    return {
      ok: false,
      version: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION,
      mode: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES.SKELETON_ONLY,
      decision: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_DECISIONS.REQUEST_REJECTED,
      reason: "invalid_entries_input",
      summary: {
        entriesChecked: 0,
        staleCount: 0,
        conflictCount: 0,
        duplicateGroupCount: 0,
        supersededCount: 0,
        archivedCount: 0,
        contradictionCount: 0,
      },
      labels: [],
      duplicateGroups: [],
      warnings: [],
      errors: [
        createError(
          "invalid_entries_input",
          "Project Memory conflict/stale detector requires entries to be an array.",
        ),
      ],
      boundaries,
    };
  }

  const labelMap = new Map();
  const duplicateGroups = buildDuplicateGroups(normalizedEntries);
  const contradictionsByEntryId = buildContradictionEvidenceByEntryId(safeEvidence);

  normalizedEntries.forEach((entry, index) => {
    const metadata = getEntryMetadata(entry);
    const status = getEntryStatus(entry);
    const entryId = getEntryId(entry, index);

    if (status === "stale" || metadata.stale === true || normalizeText(metadata.staleReason)) {
      pushLabel(
        labelMap,
        entry,
        index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.STALE,
        createReason(
          "stale_entry_detected",
          normalizeText(metadata.staleReason) || "Entry is marked stale.",
          { status: entry.status || "" },
        ),
      );
    }

    if (
      status === "conflicted" ||
      metadata.conflictsWithVerifiedSource === true ||
      normalizeText(metadata.conflictReason)
    ) {
      pushLabel(
        labelMap,
        entry,
        index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.CONFLICTED,
        createReason(
          "conflicted_entry_detected",
          normalizeText(metadata.conflictReason) || "Entry is marked conflicted.",
          { status: entry.status || "" },
        ),
      );
    }

    if (
      status === "superseded" ||
      normalizeText(entry.supersedesId || entry.supersedes_id) ||
      normalizeText(metadata.supersededBy)
    ) {
      pushLabel(
        labelMap,
        entry,
        index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.SUPERSEDED,
        createReason(
          "superseded_entry_detected",
          normalizeText(metadata.supersededBy)
            ? `Entry is superseded by ${normalizeText(metadata.supersededBy)}.`
            : "Entry is marked superseded.",
          {
            status: entry.status || "",
            supersedesId: normalizeText(entry.supersedesId || entry.supersedes_id),
          },
        ),
      );
    }

    if (status === "archived") {
      pushLabel(
        labelMap,
        entry,
        index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.ARCHIVED,
        createReason("archived_entry_detected", "Entry is archived."),
      );
    }

    const contradictions = contradictionsByEntryId.get(entryId) || [];
    contradictions.forEach((evidence) => {
      pushLabel(
        labelMap,
        entry,
        index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.CONTRADICTED_BY_VERIFIED_EVIDENCE,
        createReason("verified_evidence_contradiction_detected", evidence.reason, {
          sourceType: evidence.sourceType,
          sourceRef: evidence.sourceRef,
        }),
        evidence,
      );
    });
  });

  duplicateGroups.forEach((group) => {
    group.entries.forEach((groupEntry) => {
      const entry = normalizedEntries[groupEntry.index];
      pushLabel(
        labelMap,
        entry,
        groupEntry.index,
        PROJECT_MEMORY_CONFLICT_STALE_LABELS.DUPLICATE,
        createReason("duplicate_entry_candidate_detected", "Entry shares projectKey, type, title, and sourceRef with another entry.", {
          duplicateKey: group.key,
          duplicateEntryIds: group.entries.map((item) => item.entryId),
        }),
      );
    });
  });

  const labels = [...labelMap.values()];

  const countLabels = (label) => labels.filter((item) => item.labels.includes(label)).length;
  const contradictionCount = labels.reduce(
    (count, item) => count + item.evidence.filter((evidence) => evidence.kind === "contradiction").length,
    0,
  );

  const warnings = [];
  if (safeOptions.includeCleanEntries === true) {
    warnings.push({
      code: "include_clean_entries_ignored",
      message: "Skeleton detector returns labelled entries only; clean entries are counted in summary.",
    });
  }

  return {
    ok: true,
    version: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION,
    mode: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_DECISIONS.ANALYSIS_COMPLETED,
    summary: {
      entriesChecked: normalizedEntries.length,
      staleCount: countLabels(PROJECT_MEMORY_CONFLICT_STALE_LABELS.STALE),
      conflictCount: countLabels(PROJECT_MEMORY_CONFLICT_STALE_LABELS.CONFLICTED),
      duplicateGroupCount: duplicateGroups.length,
      supersededCount: countLabels(PROJECT_MEMORY_CONFLICT_STALE_LABELS.SUPERSEDED),
      archivedCount: countLabels(PROJECT_MEMORY_CONFLICT_STALE_LABELS.ARCHIVED),
      contradictionCount,
    },
    labels,
    duplicateGroups,
    warnings,
    errors: [],
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_VERSION,
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_MODES,
  PROJECT_MEMORY_CONFLICT_STALE_DETECTOR_DECISIONS,
  PROJECT_MEMORY_CONFLICT_STALE_LABELS,
  buildProjectMemoryConflictStaleDetectorStatus,
  getProjectMemoryConflictStaleDetectorBoundaries,
  detectProjectMemoryConflictsAndStaleness,
};
