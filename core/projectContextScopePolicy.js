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

import {
  PROJECT_CONTEXT_SCOPE_PROJECT_AREA_RULES,
  PROJECT_CONTEXT_SCOPE_REPO_SCOPE_RULES,
  PROJECT_CONTEXT_SCOPE_LINKED_REPO_RULES,
  PROJECT_CONTEXT_SCOPE_LINKED_AREA_RULES,
  PROJECT_CONTEXT_SCOPE_CROSS_REPO_RULES,
} from "./projectContextScopePolicyRules.js";

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

function equalsAny(value = "", markers = []) {
  const v = safeText(value).toLowerCase();
  return markers.some((marker) => v === String(marker).toLowerCase());
}

function matchesRule(rule = {}, { targetEntity, targetPath } = {}) {
  const entity = safeText(targetEntity).toLowerCase();
  const path = safeText(targetPath).toLowerCase();

  const hasEntityEquals =
    Array.isArray(rule.entityEquals) && rule.entityEquals.length > 0;
  const hasPathPrefixes =
    Array.isArray(rule.pathPrefixes) && rule.pathPrefixes.length > 0;
  const hasPathIncludes =
    Array.isArray(rule.pathIncludes) && rule.pathIncludes.length > 0;

  if (
    hasEntityEquals &&
    equalsAny(entity, rule.entityEquals)
  ) {
    return true;
  }

  if (
    hasPathPrefixes &&
    startsWithAny(path, rule.pathPrefixes)
  ) {
    return true;
  }

  if (
    hasPathIncludes &&
    includesAny(path, rule.pathIncludes)
  ) {
    return true;
  }

  return false;
}

function resolveValueByRules(rules = [], fieldName, { targetEntity, targetPath } = {}) {
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || typeof rule !== "object") continue;
    if (!matchesRule(rule, { targetEntity, targetPath })) continue;

    const value = rule[fieldName];
    if (fieldName === "crossRepo") {
      if (typeof value === "boolean") return value;
      continue;
    }

    const normalized = normalizeOptionalText(value);
    if (normalized) return normalized;
  }

  return fieldName === "crossRepo" ? undefined : null;
}

export function resolveProjectContextScopeByRepoObject(input = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  if (
    source.projectContextScope &&
    typeof source.projectContextScope === "object" &&
    !Array.isArray(source.projectContextScope)
  ) {
    return normalizeScope(source.projectContextScope);
  }

  const isActive = source.isActive === true;
  const targetEntity = safeText(source.targetEntity);
  const targetPath = safeText(source.targetPath);
  const objectKind = safeText(source.objectKind);

  if (!isActive && !targetEntity && !targetPath && !objectKind) {
    return {};
  }

  const projectArea = resolveValueByRules(
    PROJECT_CONTEXT_SCOPE_PROJECT_AREA_RULES,
    "projectArea",
    { targetEntity, targetPath }
  );

  let repoScope = resolveValueByRules(
    PROJECT_CONTEXT_SCOPE_REPO_SCOPE_RULES,
    "repoScope",
    { targetEntity, targetPath }
  );

  const linkedRepo = resolveValueByRules(
    PROJECT_CONTEXT_SCOPE_LINKED_REPO_RULES,
    "linkedRepo",
    { targetEntity, targetPath }
  );

  const linkedArea = resolveValueByRules(
    PROJECT_CONTEXT_SCOPE_LINKED_AREA_RULES,
    "linkedArea",
    { targetEntity, targetPath }
  );

  let crossRepo = resolveValueByRules(
    PROJECT_CONTEXT_SCOPE_CROSS_REPO_RULES,
    "crossRepo",
    { targetEntity, targetPath }
  );

  // Safe default:
  // if we only know this is some repo object in current SG project, but no explicit
  // repo tag exists, current main SG repo remains shared.
  if (!repoScope && (targetEntity || targetPath || objectKind)) {
    repoScope = "shared";
  }

  // Safe normalization:
  // explicit linked repo implies cross-repo context.
  if (typeof crossRepo !== "boolean" && linkedRepo) {
    crossRepo = true;
  }

  const out = {};

  if (projectArea) out.projectArea = projectArea;
  if (repoScope) out.repoScope = repoScope;
  if (linkedArea) out.linkedArea = linkedArea;
  if (linkedRepo) out.linkedRepo = linkedRepo;
  if (typeof crossRepo === "boolean") out.crossRepo = crossRepo;

  return normalizeScope(out);
}

export default {
  resolveProjectContextScopeByRepoObject,
};