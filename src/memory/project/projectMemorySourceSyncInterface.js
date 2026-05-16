// src/memory/project/projectMemorySourceSyncInterface.js
// SG 2.0 — Project Memory Source Sync Interface Skeleton.
// Purpose: prepare safe Project Memory candidate drafts from provided approved source payloads.
// This module accepts provided source payloads only and never fetches live sources.
// Do not add DB access, Telegram logic, AI calls, GitHub/Render/web fetching,
// runtime file writes, repository mutation, env changes, cron/timer execution,
// confirmed memory writes, auto-confirmation, or prompt injection here.

export const PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION = 1;

export const PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_DECISIONS = Object.freeze({
  SYNC_PREPARED: "source_sync_prepared",
  REQUEST_REJECTED: "source_sync_request_rejected",
});

export const PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES = Object.freeze({
  PILLARS: "pillars",
  REPO_EVIDENCE: "repo_evidence",
  RUNTIME_OBSERVATION: "runtime_observation",
  APPROVED_SESSION_SUMMARY: "approved_session_summary",
  MANUAL_MONARCH_COMMAND: "manual_monarch_command",
});

const ALLOWED_SOURCE_TYPES = new Set(Object.values(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES));

const SECRET_PATTERNS = [
  /DATABASE_URL\s*=/i,
  /OPENAI_API_KEY\s*=/i,
  /TELEGRAM_BOT_TOKEN\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /GITHUB_PRIVATE_KEY\s*=/i,
  /RENDER_API_KEY\s*=/i,
  /sk-[a-z0-9_-]{16,}/i,
  /ghp_[a-z0-9_]{16,}/i,
  /github_pat_[a-z0-9_]{16,}/i,
];

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

function normalizeSourceType(source = {}) {
  return normalizeComparisonText(source.sourceType || source.source_type || source.type);
}

function normalizeSourceRef(source = {}) {
  return normalizeText(source.sourceRef || source.source_ref || source.ref);
}

function normalizeSourceId(source = {}, fallbackIndex = 0) {
  return normalizeText(source.id || source.sourceId || source.source_id) || `source_${fallbackIndex}`;
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function containsSecret(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function sourceContainsSecret(source = {}) {
  const metadata = normalizePlainObject(source.metadata);
  return [
    source.title,
    source.summary,
    source.description,
    source.sourceRef,
    source.source_ref,
    source.ref,
    source.content,
    source.rawContent,
    source.raw_content,
    metadata.summary,
    metadata.description,
  ].some(containsSecret);
}

function sourceContainsRawLog(source = {}) {
  const metadata = normalizePlainObject(source.metadata);
  if (metadata.rawLog === true || metadata.raw_log === true) return true;
  if (source.rawLog === true || source.raw_log === true) return true;

  const rawText = normalizeText(source.rawContent || source.raw_content || source.content);
  if (!rawText) return false;

  return (
    /\b(stack trace|traceback|uncaught exception|npm err!|at [\w./-]+:\d+:\d+)\b/i.test(rawText) ||
    rawText.split("\n").length > 20
  );
}

function buildCandidateDraft(source = {}, index = 0) {
  const sourceType = normalizeSourceType(source);
  const sourceRef = normalizeSourceRef(source);
  const sourceId = normalizeSourceId(source, index);
  const metadata = normalizePlainObject(source.metadata);

  return {
    id: `project_memory_sync_candidate_${sourceId}`,
    trust: "candidate",
    status: "pending_confirmation",
    sourceType,
    sourceRef,
    sourceId,
    projectKey: normalizeText(source.projectKey || source.project_key || metadata.projectKey || metadata.project_key),
    scope: normalizeText(source.scope || metadata.scope),
    candidateType: normalizeText(source.candidateType || source.candidate_type || source.memoryType || source.memory_type),
    title: normalizeText(source.title || metadata.title),
    summary: normalizeText(source.summary || metadata.summary),
    sourceMetadata: {
      sourceType,
      sourceRef,
      sourceId,
      importedRawContent: false,
      importedRawLogs: false,
      importedSecrets: false,
    },
  };
}

function validateApprovedSource(source = {}, index = 0) {
  const sourceType = normalizeSourceType(source);
  const sourceRef = normalizeSourceRef(source);
  const sourceId = normalizeSourceId(source, index);
  const errors = [];
  const warnings = [];

  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) {
    errors.push(
      createError("source_type_not_allowlisted", "Source type is not allowlisted for Project Memory source sync.", {
        sourceId,
        sourceType,
      }),
    );
  }

  if (!sourceRef) {
    errors.push(
      createError("missing_source_ref", "Project Memory source sync requires a sourceRef/source_ref.", {
        sourceId,
        sourceType,
      }),
    );
  }

  if (sourceContainsSecret(source)) {
    errors.push(
      createError("secret_like_content_rejected", "Source payload contains secret-like material and is rejected.", {
        sourceId,
        sourceType,
      }),
    );
  }

  if (sourceContainsRawLog(source)) {
    errors.push(
      createError("raw_log_like_content_rejected", "Source payload contains raw-log-like material and is rejected.", {
        sourceId,
        sourceType,
      }),
    );
  }

  if (normalizeText(source.content || source.rawContent || source.raw_content)) {
    warnings.push(
      createWarning("raw_content_ignored", "Skeleton sync prefers source references; raw content is not copied into candidate drafts.", {
        sourceId,
        sourceType,
      }),
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function getProjectMemorySourceSyncInterfaceBoundaries() {
  return {
    transportIndependent: true,
    approvedSourcesOnly: true,
    allowlistedSourcesOnly: true,
    providedSourcesOnly: true,
    prefersSourceReferences: true,
    importsRawContent: false,
    importsRawLogs: false,
    importsSecrets: false,
    autonomousCronOrTimer: false,
    createsCandidateDrafts: true,
    createsDurableCandidates: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    readsStorage: false,
    writesStorage: false,
    callsAI: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesWeb: false,
    fetchesSources: false,
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

export function buildProjectMemorySourceSyncInterfaceStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemorySourceSyncInterface",
    version: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION,
    mode: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES.SKELETON_ONLY,
    allowedSourceTypes: Object.values(PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES),
    canPrepareCandidateDrafts: true,
    canCreateDurableCandidates: false,
    canConfirmCandidate: false,
    canFetchSources: false,
    canRunAutonomousSync: false,
    canWriteStorage: false,
    callsAI: false,
    boundaries: getProjectMemorySourceSyncInterfaceBoundaries(),
  };
}

export function prepareProjectMemorySourceSync({ sources = [], options = {} } = {}) {
  const normalizedOptions = normalizePlainObject(options);
  const boundaries = getProjectMemorySourceSyncInterfaceBoundaries();

  if (!Array.isArray(sources)) {
    return {
      ok: false,
      version: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION,
      mode: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES.SKELETON_ONLY,
      decision: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_DECISIONS.REQUEST_REJECTED,
      reason: "invalid_sources_input",
      summary: {
        sourcesChecked: 0,
        acceptedSources: 0,
        rejectedSources: 0,
        candidateDraftsCreated: 0,
      },
      candidates: [],
      warnings: [],
      errors: [
        createError("invalid_sources_input", "Project Memory source sync requires sources to be an array."),
      ],
      boundaries,
    };
  }

  const candidates = [];
  const warnings = [];
  const errors = [];

  if (normalizedOptions.trustedPathApproved === true) {
    warnings.push(
      createWarning(
        "trusted_path_ignored_in_skeleton",
        "Skeleton source sync does not confirm candidates even when trustedPathApproved is true.",
      ),
    );
  }

  sources.forEach((sourceInput, index) => {
    const source = normalizePlainObject(sourceInput);
    const validation = validateApprovedSource(source, index);
    warnings.push(...validation.warnings);

    if (!validation.ok) {
      errors.push(...validation.errors);
      return;
    }

    candidates.push(buildCandidateDraft(source, index));
  });

  return {
    ok: true,
    version: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION,
    mode: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_DECISIONS.SYNC_PREPARED,
    summary: {
      sourcesChecked: sources.length,
      acceptedSources: candidates.length,
      rejectedSources: errors.length,
      candidateDraftsCreated: candidates.length,
    },
    candidates,
    warnings,
    errors,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_VERSION,
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_MODES,
  PROJECT_MEMORY_SOURCE_SYNC_INTERFACE_DECISIONS,
  PROJECT_MEMORY_SOURCE_SYNC_SOURCE_TYPES,
  buildProjectMemorySourceSyncInterfaceStatus,
  getProjectMemorySourceSyncInterfaceBoundaries,
  prepareProjectMemorySourceSync,
};
