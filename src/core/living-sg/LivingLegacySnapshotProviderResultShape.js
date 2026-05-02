// src/core/living-sg/LivingLegacySnapshotProviderResultShape.js
// ============================================================================
// LIVING SG — Legacy Snapshot Provider Result Shape Skeleton
//
// Purpose:
// - describe safe providerResult shapes for already-provided legacy DB snapshot data;
// - separate DB snapshot metadata from real GitHub/file-content reads;
// - prepare snapshot-only providerResult objects for the result adapter;
// - block file content, token-backed reads, writes and execution.
//
// Hard boundaries:
// - no database reads here;
// - no repository reads here;
// - no repository writes here;
// - no source calls here;
// - no provider calls here;
// - no loadLatestSnapshot() calls here;
// - no fetchRepoFileText() calls here;
// - no GitHub token usage here;
// - no executor;
// - no RepoStateAgent runtime connection;
// - no Human Meaning Provider connection;
// - no Technical Mode expansion;
// - no slash-command dependency.
// ============================================================================

import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "./LivingRepoSourceProviderBoundary.js";
import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
} from "./LivingSourceResultEnvelope.js";

export const LIVING_LEGACY_SNAPSHOT_RESULT_KIND = Object.freeze({
  REPO_STATUS: "repo_status",
  REPO_TREE: "repo_tree",
  REPO_SEARCH: "repo_search",
  PATH_KIND: "path_kind",
  PATH_EXISTS: "path_exists",
  UNKNOWN: "unknown",
});

export const LIVING_LEGACY_SNAPSHOT_RESULT_STATUS = Object.freeze({
  BUILT: "built",
  INVALID_INPUT: "invalid_input",
  BLOCKED_FILE_CONTENT: "blocked_file_content",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeResultKind(value) {
  const v = safeText(value);

  if (v === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS) {
    return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS;
  }

  if (v === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE) {
    return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE;
  }

  if (v === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH) {
    return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH;
  }

  if (v === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND) {
    return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND;
  }

  if (v === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS) {
    return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS;
  }

  return LIVING_LEGACY_SNAPSHOT_RESULT_KIND.UNKNOWN;
}

function buildTarget(input = {}) {
  return {
    repository: safeText(input.repository),
    ref: safeText(input.ref || input.branch),
    path: safeText(input.path || input.prefix || input.query),
    scope: safeText(input.scope || input.kind),
  };
}

function buildBaseMetadata({ resultKind, blockedFileContent = false } = {}) {
  return {
    shapeOnly: true,
    snapshotOnly: true,
    resultKind,
    blockedFileContent,
    rawSnapshotIsNotProof: true,
    providerResultIsNotProofUntilAdapted: true,
    mustUseResultAdapter: true,
    noDbRead: true,
    noRuntimeRepoRead: true,
    noRuntimeRepoWrite: true,
    noSourceCall: true,
    noProviderCall: true,
    noLoadLatestSnapshotCall: true,
    noFetchRepoFileTextCall: true,
    noGitHubTokenUsage: true,
    noExecutor: true,
    noRepoStateAgentRuntime: true,
    noHumanMeaningProvider: true,
    noTechnicalModeExpansion: true,
    noSlashCommandsAdded: true,
    cannotAuthorizeWrites: true,
  };
}

function buildProviderResult({ resultKind, target, payload, confirmed, freshnessStatus, checkedAt, sourceUpdatedAt, reason }) {
  return {
    providerKind: LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER,
    legacySnapshotResultKind: resultKind,
    target,
    payload,
    confirmed: safeBool(confirmed),
    confirmedBy: "LivingLegacySnapshotProviderResultShape",
    readOnly: true,
    canAuthorizeWrite: false,
    canExecute: false,
    freshnessStatus: safeText(freshnessStatus) || LIVING_SOURCE_RESULT_FRESHNESS_STATUS.UNKNOWN,
    checkedAt: safeText(checkedAt),
    sourceUpdatedAt: safeText(sourceUpdatedAt),
    reason: safeText(reason) || "legacy_snapshot_provider_result_shape_built",
  };
}

export function createLegacySnapshotRepoStatusProviderResult(input = {}) {
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    scope: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS,
    kind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS,
  });

  const latest = isPlainObject(input.latest) ? input.latest : null;
  const filesCount = Number.isFinite(input.filesCount) ? input.filesCount : 0;
  const ok = latest !== null || safeBool(input.ok);

  const payload = {
    ok,
    repo: target.repository,
    branch: target.ref,
    latest,
    filesCount,
  };

  const providerResult = buildProviderResult({
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS,
    target,
    payload,
    confirmed: safeBool(input.confirmed),
    freshnessStatus: input.freshnessStatus,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    reason: "legacy_snapshot_repo_status_shape_built",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS,
    providerResult,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "repo_status_provider_result_shape_built",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS }),
  };
}

export function createLegacySnapshotRepoTreeProviderResult(input = {}) {
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    path: input.prefix,
    scope: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE,
    kind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE,
  });

  const payload = {
    prefix: safeText(input.prefix),
    directories: safeArray(input.directories).map(safeText).filter(Boolean),
    files: safeArray(input.files).map(safeText).filter(Boolean),
    hiddenCount: Number.isFinite(input.hiddenCount) ? input.hiddenCount : 0,
  };

  const providerResult = buildProviderResult({
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE,
    target,
    payload,
    confirmed: safeBool(input.confirmed),
    freshnessStatus: input.freshnessStatus,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    reason: "legacy_snapshot_repo_tree_shape_built",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE,
    providerResult,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "repo_tree_provider_result_shape_built",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE }),
  };
}

export function createLegacySnapshotRepoSearchProviderResult(input = {}) {
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    path: input.query,
    scope: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH,
    kind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH,
  });

  const payload = {
    query: safeText(input.query),
    matches: safeArray(input.matches).map(safeText).filter(Boolean),
    objectKind: safeText(input.objectKind || "unknown"),
  };

  const providerResult = buildProviderResult({
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH,
    target,
    payload,
    confirmed: safeBool(input.confirmed),
    freshnessStatus: input.freshnessStatus,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    reason: "legacy_snapshot_repo_search_shape_built",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH,
    providerResult,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "repo_search_provider_result_shape_built",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH }),
  };
}

export function createLegacySnapshotPathKindProviderResult(input = {}) {
  const path = safeText(input.path);
  const pathKind = safeText(input.pathKind || "unknown");
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    path,
    scope: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND,
    kind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND,
  });

  const payload = {
    path,
    pathKind,
  };

  const providerResult = buildProviderResult({
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND,
    target,
    payload,
    confirmed: safeBool(input.confirmed),
    freshnessStatus: input.freshnessStatus,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    reason: "legacy_snapshot_path_kind_shape_built",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND,
    providerResult,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "path_kind_provider_result_shape_built",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND }),
  };
}

export function createLegacySnapshotPathExistsProviderResult(input = {}) {
  const path = safeText(input.path);
  const exists = safeBool(input.exists);
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    path,
    scope: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS,
    kind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS,
  });

  const payload = {
    path,
    exists,
  };

  const providerResult = buildProviderResult({
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS,
    target,
    payload,
    confirmed: safeBool(input.confirmed),
    freshnessStatus: input.freshnessStatus,
    checkedAt: input.checkedAt,
    sourceUpdatedAt: input.sourceUpdatedAt,
    reason: "legacy_snapshot_path_exists_shape_built",
  });

  return {
    ok: true,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS,
    providerResult,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "path_exists_provider_result_shape_built",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS }),
  };
}

export function createBlockedLegacySnapshotFileContentProviderResult(input = {}) {
  const target = buildTarget({
    repository: input.repository,
    ref: input.ref || input.branch,
    path: input.path,
    scope: "file_content_blocked",
    kind: "file_content_blocked",
  });

  return {
    ok: false,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BLOCKED_FILE_CONTENT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.UNKNOWN,
    providerResult: null,
    target,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "file_content_requires_separate_repo_read_provider",
    metadata: buildBaseMetadata({
      resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.UNKNOWN,
      blockedFileContent: true,
    }),
  };
}

export function createLegacySnapshotProviderResultShape(input = {}) {
  const resultKind = normalizeResultKind(input.resultKind || input.kind);

  if (safeBool(input.fileContentRequested)) {
    return createBlockedLegacySnapshotFileContentProviderResult(input);
  }

  if (resultKind === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS) {
    return createLegacySnapshotRepoStatusProviderResult(input);
  }

  if (resultKind === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE) {
    return createLegacySnapshotRepoTreeProviderResult(input);
  }

  if (resultKind === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH) {
    return createLegacySnapshotRepoSearchProviderResult(input);
  }

  if (resultKind === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND) {
    return createLegacySnapshotPathKindProviderResult(input);
  }

  if (resultKind === LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS) {
    return createLegacySnapshotPathExistsProviderResult(input);
  }

  return {
    ok: false,
    dryRun: true,
    source: "LivingLegacySnapshotProviderResultShape",
    status: LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.INVALID_INPUT,
    resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.UNKNOWN,
    providerResult: null,
    canReadDb: false,
    canReadRepo: false,
    canWriteRepo: false,
    canExecute: false,
    reason: "unknown_legacy_snapshot_result_kind",
    metadata: buildBaseMetadata({ resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.UNKNOWN }),
  };
}

export default {
  LIVING_LEGACY_SNAPSHOT_RESULT_KIND,
  LIVING_LEGACY_SNAPSHOT_RESULT_STATUS,
  createLegacySnapshotRepoStatusProviderResult,
  createLegacySnapshotRepoTreeProviderResult,
  createLegacySnapshotRepoSearchProviderResult,
  createLegacySnapshotPathKindProviderResult,
  createLegacySnapshotPathExistsProviderResult,
  createBlockedLegacySnapshotFileContentProviderResult,
  createLegacySnapshotProviderResultShape,
};
