// src/memory/project/projectMemoryDiagnostics.js
// SG 2.0 — Project Memory Diagnostics Skeleton.
// Purpose: build sanitized Project Memory health diagnostics from provided snapshots only.
// This module does not verify live DB/runtime state by itself.
// Do not add DB access, Telegram logic, AI calls, GitHub/Render/web fetching,
// runtime file writes, repository mutation, env changes, confirmed memory writes,
// auto-confirmation, raw log output, secret output, or prompt injection here.

export const PROJECT_MEMORY_DIAGNOSTICS_VERSION = 1;

export const PROJECT_MEMORY_DIAGNOSTICS_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const PROJECT_MEMORY_DIAGNOSTICS_DECISIONS = Object.freeze({
  DIAGNOSTICS_BUILT: "project_memory_diagnostics_built",
  REQUEST_REJECTED: "project_memory_diagnostics_request_rejected",
});

export const PROJECT_MEMORY_DIAGNOSTIC_FAMILIES = Object.freeze({
  STORAGE_STATUS: "storage_status",
  SCHEMA_STATUS: "schema_status",
  CANDIDATE_COUNT: "candidate_count",
  CONFIRMED_COUNT: "confirmed_count",
  STALE_CONFLICT_COUNT: "stale_conflict_count",
  FEATURE_FLAGS: "feature_flags",
  READ_GATE_STATUS: "read_gate_status",
  WRITE_GATE_STATUS: "write_gate_status",
  LAST_RESTORE_CONTEXT_SUMMARY: "last_restore_context_summary",
});

export const PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS = Object.freeze({
  AVAILABLE_CODE: "available_code",
  CONFIGURED_RUNTIME: "configured_runtime",
  VERIFIED_DB_STATE: "verified_db_state",
  PRODUCTION_READINESS: "production_readiness",
});

const SECRET_PATTERNS = [
  /DATABASE_URL/i,
  /OPENAI_API_KEY/i,
  /TELEGRAM_BOT_TOKEN/i,
  /GITHUB_TOKEN/i,
  /GITHUB_PRIVATE_KEY/i,
  /RENDER_API_KEY/i,
  /sk-[a-z0-9_-]{16,}/i,
  /ghp_[a-z0-9_]{16,}/i,
  /github_pat_[a-z0-9_]{16,}/i,
  /postgres(?:ql)?:\/\//i,
];

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

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normalizeNonNegativeInteger(value) {
  if (Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.floor(value);
  return 0;
}

function containsSecretLikeText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function containsForbiddenOutput(value) {
  if (containsSecretLikeText(value)) return true;
  const text = normalizeText(value);
  if (!text) return false;
  return (
    /raw\s*logs?/i.test(text) ||
    /provider\s*id/i.test(text) ||
    /transport\s*id/i.test(text) ||
    /user[_-]?id\s*[:=]/i.test(text) ||
    /chat[_-]?id\s*[:=]/i.test(text)
  );
}

function sanitizeSummary(value, fallback = "not_provided") {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (containsForbiddenOutput(text)) return "redacted";
  return text.slice(0, 240);
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function buildStorageStatus(snapshot = {}) {
  const storage = normalizePlainObject(snapshot.storage);
  return {
    family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.STORAGE_STATUS,
    evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME,
    configured: normalizeBoolean(storage.configured),
    reachable: normalizeBoolean(storage.reachable),
    verified: normalizeBoolean(storage.verified),
    summary: sanitizeSummary(storage.summary, "storage_status_not_provided"),
  };
}

function buildSchemaStatus(snapshot = {}) {
  const schema = normalizePlainObject(snapshot.schema);
  return {
    family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.SCHEMA_STATUS,
    evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE,
    expectedTablesKnown: normalizeBoolean(schema.expectedTablesKnown),
    tablesVerified: normalizeBoolean(schema.tablesVerified),
    indexesVerified: normalizeBoolean(schema.indexesVerified),
    constraintsVerified: normalizeBoolean(schema.constraintsVerified),
    summary: sanitizeSummary(schema.summary, "schema_status_not_provided"),
  };
}

function buildCounts(snapshot = {}) {
  const counts = normalizePlainObject(snapshot.counts);
  return {
    candidateCount: {
      family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.CANDIDATE_COUNT,
      evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE,
      value: normalizeNonNegativeInteger(counts.candidateCount ?? counts.candidates),
      verified: normalizeBoolean(counts.verified),
    },
    confirmedCount: {
      family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.CONFIRMED_COUNT,
      evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE,
      value: normalizeNonNegativeInteger(counts.confirmedCount ?? counts.confirmed),
      verified: normalizeBoolean(counts.verified),
    },
    staleConflictCount: {
      family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.STALE_CONFLICT_COUNT,
      evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE,
      stale: normalizeNonNegativeInteger(counts.staleCount ?? counts.stale),
      conflicted: normalizeNonNegativeInteger(counts.conflictCount ?? counts.conflicted),
      verified: normalizeBoolean(counts.verified),
    },
  };
}

function buildFeatureFlags(snapshot = {}) {
  const featureFlags = normalizePlainObject(snapshot.featureFlags || snapshot.feature_flags);
  return {
    family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.FEATURE_FLAGS,
    evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME,
    readEnabled: normalizeBoolean(featureFlags.readEnabled || featureFlags.read_enabled),
    writeEnabled: normalizeBoolean(featureFlags.writeEnabled || featureFlags.write_enabled),
    sourceSyncEnabled: normalizeBoolean(featureFlags.sourceSyncEnabled || featureFlags.source_sync_enabled),
    autoConfirmEnabled: normalizeBoolean(featureFlags.autoConfirmEnabled || featureFlags.auto_confirm_enabled),
    promptInjectionEnabled: normalizeBoolean(featureFlags.promptInjectionEnabled || featureFlags.prompt_injection_enabled),
  };
}

function buildGateStatus(snapshot = {}) {
  const readGate = normalizePlainObject(snapshot.readGate || snapshot.read_gate);
  const writeGate = normalizePlainObject(snapshot.writeGate || snapshot.write_gate);

  return {
    readGateStatus: {
      family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.READ_GATE_STATUS,
      evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME,
      enabled: normalizeBoolean(readGate.enabled),
      confirmedOnly: normalizeBoolean(readGate.confirmedOnly || readGate.confirmed_only),
      bounded: normalizeBoolean(readGate.bounded),
      summary: sanitizeSummary(readGate.summary, "read_gate_status_not_provided"),
    },
    writeGateStatus: {
      family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.WRITE_GATE_STATUS,
      evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME,
      enabled: normalizeBoolean(writeGate.enabled),
      candidateOnly: normalizeBoolean(writeGate.candidateOnly || writeGate.candidate_only),
      requiresConfirmation: normalizeBoolean(writeGate.requiresConfirmation || writeGate.requires_confirmation),
      summary: sanitizeSummary(writeGate.summary, "write_gate_status_not_provided"),
    },
  };
}

function buildLastRestoreContextSummary(snapshot = {}) {
  const restore = normalizePlainObject(snapshot.lastRestoreContext || snapshot.last_restore_context);
  return {
    family: PROJECT_MEMORY_DIAGNOSTIC_FAMILIES.LAST_RESTORE_CONTEXT_SUMMARY,
    evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.AVAILABLE_CODE,
    available: normalizeBoolean(restore.available),
    entryCount: normalizeNonNegativeInteger(restore.entryCount || restore.entry_count),
    charCount: normalizeNonNegativeInteger(restore.charCount || restore.char_count),
    staleOrConflictLabelsPresent: normalizeBoolean(
      restore.staleOrConflictLabelsPresent || restore.stale_or_conflict_labels_present,
    ),
    summary: sanitizeSummary(restore.summary, "last_restore_context_summary_not_provided"),
  };
}

function computeProductionReadiness({ storageStatus, schemaStatus, counts, featureFlags, gateStatus }) {
  const ready =
    storageStatus.configured === true &&
    storageStatus.reachable === true &&
    storageStatus.verified === true &&
    schemaStatus.tablesVerified === true &&
    schemaStatus.indexesVerified === true &&
    schemaStatus.constraintsVerified === true &&
    counts.candidateCount.verified === true &&
    counts.confirmedCount.verified === true &&
    counts.staleConflictCount.verified === true &&
    featureFlags.autoConfirmEnabled === false &&
    featureFlags.promptInjectionEnabled === false &&
    gateStatus.readGateStatus.bounded === true &&
    gateStatus.writeGateStatus.requiresConfirmation === true;

  return {
    family: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.PRODUCTION_READINESS,
    evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.PRODUCTION_READINESS,
    ready,
    claim: ready ? "production_readiness_supported_by_provided_verified_snapshot" : "production_readiness_not_established",
  };
}

export function getProjectMemoryDiagnosticsBoundaries() {
  return {
    transportIndependent: true,
    providedSnapshotOnly: true,
    distinguishesAvailableCodeConfiguredRuntimeVerifiedDbAndProductionReadiness: true,
    emitsSanitizedDiagnosticsOnly: true,
    emitsSecrets: false,
    emitsRawDatabaseUrl: false,
    emitsRawLogs: false,
    emitsRawProviderIds: false,
    emitsPrivateTransportIds: false,
    emitsUnredactedUserIdentifiers: false,
    readsStorage: false,
    writesStorage: false,
    createsCandidates: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
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

export function buildProjectMemoryDiagnosticsStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryDiagnostics",
    version: PROJECT_MEMORY_DIAGNOSTICS_VERSION,
    mode: PROJECT_MEMORY_DIAGNOSTICS_MODES.SKELETON_ONLY,
    families: Object.values(PROJECT_MEMORY_DIAGNOSTIC_FAMILIES),
    evidenceLevels: Object.values(PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS),
    canUseProvidedSnapshot: true,
    canVerifyLiveDbState: false,
    canClaimProductionReadinessWithoutVerifiedSnapshot: false,
    canEmitSecrets: false,
    canEmitRawLogs: false,
    callsAI: false,
    boundaries: getProjectMemoryDiagnosticsBoundaries(),
  };
}

export function buildProjectMemoryDiagnostics({ snapshot = {} } = {}) {
  const boundaries = getProjectMemoryDiagnosticsBoundaries();

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {
      ok: false,
      version: PROJECT_MEMORY_DIAGNOSTICS_VERSION,
      mode: PROJECT_MEMORY_DIAGNOSTICS_MODES.SKELETON_ONLY,
      decision: PROJECT_MEMORY_DIAGNOSTICS_DECISIONS.REQUEST_REJECTED,
      reason: "invalid_snapshot_input",
      diagnostics: null,
      warnings: [],
      errors: [
        createError("invalid_snapshot_input", "Project Memory diagnostics requires snapshot to be an object."),
      ],
      boundaries,
    };
  }

  const providedSnapshot = normalizePlainObject(snapshot);
  const warnings = [];

  if (Object.values(providedSnapshot).some((value) => containsForbiddenOutput(JSON.stringify(value)))) {
    warnings.push(
      createWarning(
        "snapshot_contains_forbidden_material",
        "Forbidden diagnostic material was detected and sanitized/redacted from summaries.",
      ),
    );
  }

  const storageStatus = buildStorageStatus(providedSnapshot);
  const schemaStatus = buildSchemaStatus(providedSnapshot);
  const counts = buildCounts(providedSnapshot);
  const featureFlags = buildFeatureFlags(providedSnapshot);
  const gateStatus = buildGateStatus(providedSnapshot);
  const lastRestoreContextSummary = buildLastRestoreContextSummary(providedSnapshot);
  const productionReadiness = computeProductionReadiness({
    storageStatus,
    schemaStatus,
    counts,
    featureFlags,
    gateStatus,
  });

  return {
    ok: true,
    version: PROJECT_MEMORY_DIAGNOSTICS_VERSION,
    mode: PROJECT_MEMORY_DIAGNOSTICS_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_DIAGNOSTICS_DECISIONS.DIAGNOSTICS_BUILT,
    diagnostics: {
      availableCode: {
        evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.AVAILABLE_CODE,
        projectMemoryDiagnosticsAvailable: true,
        summary: "Project Memory diagnostics skeleton is available.",
      },
      configuredRuntime: {
        evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.CONFIGURED_RUNTIME,
        storageStatus,
        featureFlags,
        readGateStatus: gateStatus.readGateStatus,
        writeGateStatus: gateStatus.writeGateStatus,
      },
      verifiedDbState: {
        evidenceLevel: PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS.VERIFIED_DB_STATE,
        schemaStatus,
        candidateCount: counts.candidateCount,
        confirmedCount: counts.confirmedCount,
        staleConflictCount: counts.staleConflictCount,
      },
      lastRestoreContextSummary,
      productionReadiness,
    },
    warnings,
    errors: [],
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_DIAGNOSTICS_VERSION,
  PROJECT_MEMORY_DIAGNOSTICS_MODES,
  PROJECT_MEMORY_DIAGNOSTICS_DECISIONS,
  PROJECT_MEMORY_DIAGNOSTIC_FAMILIES,
  PROJECT_MEMORY_DIAGNOSTIC_EVIDENCE_LEVELS,
  buildProjectMemoryDiagnosticsStatus,
  getProjectMemoryDiagnosticsBoundaries,
  buildProjectMemoryDiagnostics,
};
