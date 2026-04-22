// src/projectMemory/projectMemoryScopes.js
// ============================================================================
// Project Memory scopes / areas
// Purpose:
// - keep one project_memory for the whole SG project
// - support multi-repo / multi-area project structure
// - avoid hard-coded transport or repo assumptions
// ============================================================================

export const PROJECT_MEMORY_AREAS = Object.freeze({
  CORE: "core",
  CLIENT: "client",
  SHARED: "shared",
  INFRA: "infra",
  DOCS: "docs",
  CONNECTORS: "connectors",
  KINGDOM_OVERLAY: "kingdom_overlay",
});

export const DEFAULT_PROJECT_MEMORY_AREA = PROJECT_MEMORY_AREAS.SHARED;

export const PROJECT_MEMORY_REPO_SCOPES = Object.freeze({
  CORE: "core",
  CLIENT: "client",
  SHARED: "shared",
});

export function safeText(value) {
  return String(value ?? "").trim();
}

export function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeStringArray(value = []) {
  const out = [];
  const seen = new Set();

  for (const item of ensureArray(value)) {
    const normalized = safeText(item);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

export function normalizeProjectArea(value, fallback = null) {
  const normalized = safeText(value).toLowerCase();
  return normalized || fallback;
}

export function normalizeRepoScope(value, fallback = null) {
  const normalized = safeText(value).toLowerCase();
  return normalized || fallback;
}

export function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function normalizeProjectMemoryMeta(meta = {}, extra = {}, options = {}) {
  const base = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const opts =
    options && typeof options === "object" && !Array.isArray(options) ? options : {};

  const projectAreaFallback =
    Object.prototype.hasOwnProperty.call(opts, "defaultProjectArea")
      ? opts.defaultProjectArea
      : DEFAULT_PROJECT_MEMORY_AREA;

  const repoScopeFallback =
    Object.prototype.hasOwnProperty.call(opts, "defaultRepoScope")
      ? opts.defaultRepoScope
      : null;

  const crossRepoFallback =
    Object.prototype.hasOwnProperty.call(opts, "defaultCrossRepo")
      ? opts.defaultCrossRepo
      : false;

  const projectArea = normalizeProjectArea(
    extra.projectArea ?? base.projectArea,
    projectAreaFallback
  );

  const repoScope = normalizeRepoScope(
    extra.repoScope ?? base.repoScope,
    repoScopeFallback
  );

  const linkedAreas = normalizeStringArray(
    extra.linkedAreas ?? base.linkedAreas ?? []
  )
    .map((item) => normalizeProjectArea(item, ""))
    .filter(Boolean);

  const linkedRepoScopes = normalizeStringArray(
    extra.linkedRepoScopes ?? base.linkedRepoScopes ?? []
  )
    .map((item) => normalizeRepoScope(item, ""))
    .filter(Boolean);

  const crossRepo = normalizeBoolean(
    extra.crossRepo ?? base.crossRepo,
    crossRepoFallback
  );

  const out = {
    ...base,
    repoScope,
    linkedAreas,
    linkedRepoScopes,
    crossRepo,
  };

  if (projectArea) {
    out.projectArea = projectArea;
  } else {
    delete out.projectArea;
  }

  if (repoScope) {
    out.repoScope = repoScope;
  } else {
    delete out.repoScope;
  }

  return out;
}

export function readProjectAreaFromMeta(meta = {}) {
  return normalizeProjectArea(meta?.projectArea, null);
}

export function readRepoScopeFromMeta(meta = {}) {
  return normalizeRepoScope(meta?.repoScope, null);
}

export function readLinkedAreasFromMeta(meta = {}) {
  return normalizeStringArray(meta?.linkedAreas ?? [])
    .map((item) => normalizeProjectArea(item, ""))
    .filter(Boolean);
}

export function readLinkedRepoScopesFromMeta(meta = {}) {
  return normalizeStringArray(meta?.linkedRepoScopes ?? [])
    .map((item) => normalizeRepoScope(item, ""))
    .filter(Boolean);
}

export function readCrossRepoFromMeta(meta = {}) {
  return normalizeBoolean(meta?.crossRepo, false);
}

export function getProjectMemoryScopeSignature(meta = {}) {
  return {
    projectArea: readProjectAreaFromMeta(meta),
    repoScope: readRepoScopeFromMeta(meta),
    linkedAreas: readLinkedAreasFromMeta(meta),
    linkedRepoScopes: readLinkedRepoScopesFromMeta(meta),
    crossRepo: readCrossRepoFromMeta(meta),
  };
}

export default {
  PROJECT_MEMORY_AREAS,
  PROJECT_MEMORY_REPO_SCOPES,
  DEFAULT_PROJECT_MEMORY_AREA,
  normalizeProjectMemoryMeta,
  normalizeProjectArea,
  normalizeRepoScope,
  readProjectAreaFromMeta,
  readRepoScopeFromMeta,
  readLinkedAreasFromMeta,
  readLinkedRepoScopesFromMeta,
  readCrossRepoFromMeta,
  getProjectMemoryScopeSignature,
};