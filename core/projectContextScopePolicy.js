// core/projectContextScopePolicy.js
// ============================================================================
// Project Context Scope Policy
// Purpose:
// - universal explicit mapping from structured repo object context
//   to projectContextScope used by Project Memory loader
// - NO free-text parsing
// - NO transport-specific logic
// - conservative mapping only
// IMPORTANT:
// - this file is policy only
// - it must not read chat text
// - it must not read Telegram-specific fields
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value) {
  const s = safeText(value).toLowerCase();
  return s || null;
}

function normalizeScope(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  const out = {};

  const projectKey = safeText(source.projectKey);
  if (projectKey) out.projectKey = projectKey;

  const projectArea = normalizeOptionalText(source.projectArea);
  if (projectArea) out.projectArea = projectArea;

  const repoScope = normalizeOptionalText(source.repoScope);
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = normalizeOptionalText(source.linkedArea);
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = normalizeOptionalText(source.linkedRepo);
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

function startsWithAny(value = "", prefixes = []) {
  const v = safeText(value).toLowerCase();
  return prefixes.some((prefix) => v.startsWith(String(prefix).toLowerCase()));
}

function includesAny(value = "", markers = []) {
  const v = safeText(value).toLowerCase();
  return markers.some((marker) => v.includes(String(marker).toLowerCase()));
}

function resolveRepoScopeFromStructuredRepoObject({
  targetEntity,
  targetPath,
} = {}) {
  const entity = safeText(targetEntity).toLowerCase();
  const path = safeText(targetPath).toLowerCase();

  // Explicit linked repo: client
  if (
    entity === "client" ||
    entity === "repo:client" ||
    entity === "linked_repo:client" ||
    startsWithAny(path, [
      "client/",
      "apps/client/",
      "packages/client/",
    ])
  ) {
    return "client";
  }

  // Explicit shared/core repo markers if they appear in structured object context
  if (
    entity === "shared" ||
    entity === "repo:shared" ||
    entity === "linked_repo:shared" ||
    startsWithAny(path, [
      "shared/",
      "packages/shared/",
    ])
  ) {
    return "shared";
  }

  if (
    entity === "core" ||
    entity === "repo:core" ||
    entity === "linked_repo:core"
  ) {
    return "core";
  }

  // Main SG repository object context is treated as shared by default.
  if (path || entity) {
    return "shared";
  }

  return null;
}

function resolveProjectAreaFromStructuredRepoObject({
  targetEntity,
  targetPath,
  objectKind,
} = {}) {
  const entity = safeText(targetEntity).toLowerCase();
  const path = safeText(targetPath).toLowerCase();
  const kind = safeText(objectKind).toLowerCase();

  if (!entity && !path && !kind) {
    return null;
  }

  if (
    entity === "client" ||
    startsWithAny(path, [
      "client/",
      "apps/client/",
      "packages/client/",
    ])
  ) {
    return "client";
  }

  if (
    startsWithAny(path, [
      "pillars/",
      "docs/",
    ])
  ) {
    return "docs";
  }

  if (
    startsWithAny(path, [
      "src/core/",
      "core/",
      "src/bot/",
      "src/tasks/",
      "src/users/",
      "src/services/",
      "src/db/",
      "src/projectmemory/",
    ])
  ) {
    return "core";
  }

  if (
    startsWithAny(path, [
      "src/sources/",
      "src/connectors/",
    ])
  ) {
    return "connectors";
  }

  if (
    startsWithAny(path, [
      "shared/",
      "packages/shared/",
    ]) ||
    entity === "shared"
  ) {
    return "shared";
  }

  if (
    includesAny(path, [
      "render.yaml",
      "dockerfile",
      ".github/",
      "infra/",
      "deploy/",
      "deployment/",
    ])
  ) {
    return "infra";
  }

  return null;
}

export function resolveProjectContextScopeByRepoObject(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  if (source.projectContextScope && typeof source.projectContextScope === "object") {
    return normalizeScope(source.projectContextScope);
  }

  const isActive = source.isActive === true;
  const targetEntity = safeText(source.targetEntity);
  const targetPath = safeText(source.targetPath);
  const objectKind = safeText(source.objectKind);

  if (!isActive && !targetEntity && !targetPath && !objectKind) {
    return {};
  }

  const repoScope = resolveRepoScopeFromStructuredRepoObject({
    targetEntity,
    targetPath,
  });

  const projectArea = resolveProjectAreaFromStructuredRepoObject({
    targetEntity,
    targetPath,
    objectKind,
  });

  const out = {};

  if (projectArea) out.projectArea = projectArea;
  if (repoScope) out.repoScope = repoScope;

  return normalizeScope(out);
}

export default {
  resolveProjectContextScopeByRepoObject,
};