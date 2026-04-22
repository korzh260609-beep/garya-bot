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
  return ensureArray(value)
    .map((item) => safeText(item))
    .filter(Boolean);
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

export function normalizeProjectMemoryMeta(meta = {}, extra = {}) {
  const base = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};

  const projectArea = normalizeProjectArea(
    extra.projectArea ?? base.projectArea,
    DEFAULT_PROJECT_MEMORY_AREA
  );

  const repoScope = normalizeRepoScope(
    extra.repoScope ?? base.repoScope,
    null
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
    false
  );

  return {
    ...base,
    projectArea,
    repoScope,
    linkedAreas,
    linkedRepoScopes,
    crossRepo,
  };
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
};