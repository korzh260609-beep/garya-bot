// src/core/projectIntent/projectIntentProjectContextScope.js
// ============================================================================
// Project Intent -> Project Context Scope bridge
// Purpose:
// - convert structured repo conversation context into explicit projectContextScope
// - use ONLY structured repo target metadata (targetPath / targetEntity / objectKind)
// - do NOT read user free-form text
// - do NOT add Telegram-only logic
// IMPORTANT:
// - this is a bridge from explicit repo object context to Project Memory scope
// - fallback must stay conservative
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

function resolveProjectAreaFromPath(targetPath = "") {
  const path = safeText(targetPath).toLowerCase();

  if (!path) return null;

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
      "src/core/",
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

function resolveRepoScopeFromStructuredContext({
  targetEntity,
  targetPath,
} = {}) {
  const entity = safeText(targetEntity).toLowerCase();
  const path = safeText(targetPath).toLowerCase();

  // Conservative explicit linked-repo detection.
  // Only use obvious structured repo markers if they appear in repo context.
  if (
    entity === "client" ||
    entity === "linked_repo:client" ||
    entity === "repo:client" ||
    startsWithAny(path, [
      "client/",
      "apps/client/",
      "packages/client/",
    ])
  ) {
    return "client";
  }

  // Current SG main repo conversation context belongs to main/shared repo scope.
  if (path || entity) {
    return "shared";
  }

  return null;
}

export function buildProjectContextScopeFromRepoContext(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  if (source.projectContextScope && typeof source.projectContextScope === "object") {
    return normalizeScope(source.projectContextScope);
  }

  const isActive = source.isActive === true;
  const targetEntity = safeText(source.targetEntity);
  const targetPath = safeText(source.targetPath);

  if (!isActive && !targetEntity && !targetPath) {
    return {};
  }

  const repoScope = resolveRepoScopeFromStructuredContext({
    targetEntity,
    targetPath,
  });

  const projectArea = resolveProjectAreaFromPath(targetPath);

  const out = {};

  if (projectArea) out.projectArea = projectArea;
  if (repoScope) out.repoScope = repoScope;

  return normalizeScope(out);
}

export default {
  buildProjectContextScopeFromRepoContext,
};