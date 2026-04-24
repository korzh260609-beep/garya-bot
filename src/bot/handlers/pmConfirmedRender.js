// src/bot/handlers/pmConfirmedRender.js
// ============================================================================
// Project Memory confirmed render helpers
// Purpose:
// - shared Telegram rendering helpers for confirmed project memory rows
// - no business logic here
// - no policy decisions here
// - render metadata already returned by universal core/service layer
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function boolLabel(value) {
  if (typeof value !== "boolean") return "-";
  return value ? "yes" : "no";
}

function listLabel(value) {
  if (!Array.isArray(value)) return "-";

  const items = value
    .map((item) => safeText(item))
    .filter(Boolean);

  return items.length ? items.join(", ") : "-";
}

function getMeta(row) {
  return row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
    ? row.meta
    : {};
}

function getScopeView(row) {
  const meta = getMeta(row);

  return {
    area: safeText(meta.projectArea) || "-",
    repo: safeText(meta.repoScope) || "-",
    linkedAreas: listLabel(meta.linkedAreas),
    linkedRepos: listLabel(meta.linkedRepoScopes),
    crossRepo: boolLabel(meta.crossRepo),
    aiContext: boolLabel(meta.aiContext),
  };
}

function getPolicyView(row) {
  const meta = getMeta(row);

  return {
    policyVersion:
      typeof meta.confirmedScopePolicyVersion === "number"
        ? String(meta.confirmedScopePolicyVersion)
        : "-",

    requirement: safeText(meta.confirmedScopeRequirement) || "-",
    requirementReason: safeText(meta.confirmedScopeRequirementReason) || "-",

    scopeClass: safeText(meta.confirmedScopeClass) || "-",
    scopeClassReason: safeText(meta.confirmedScopeClassReason) || "-",

    validForWrite: boolLabel(meta.confirmedScopeValidForWrite),
    includeInScopedContext: boolLabel(meta.confirmedScopeIncludeInScopedContext),
    allowLegacyUnscopedRead: boolLabel(meta.confirmedScopeAllowLegacyUnscopedRead),
    migrateLegacyLater: boolLabel(meta.confirmedScopeMigrateLegacyLater),
  };
}

export function appendConfirmedScopeLines(lines, row) {
  const scope = getScopeView(row);

  lines.push(`area: ${scope.area}`);
  lines.push(`repo: ${scope.repo}`);
  lines.push(`linked_areas: ${scope.linkedAreas}`);
  lines.push(`linked_repos: ${scope.linkedRepos}`);
  lines.push(`cross_repo: ${scope.crossRepo}`);
  lines.push(`ai_context: ${scope.aiContext}`);
}

export function appendConfirmedPolicyLines(lines, row) {
  const policy = getPolicyView(row);

  lines.push(`policy_version: ${policy.policyVersion}`);
  lines.push(`policy_requirement: ${policy.requirement}`);
  lines.push(`policy_requirement_reason: ${policy.requirementReason}`);
  lines.push(`policy_scope_class: ${policy.scopeClass}`);
  lines.push(`policy_scope_class_reason: ${policy.scopeClassReason}`);
  lines.push(`policy_valid_for_write: ${policy.validForWrite}`);
  lines.push(`policy_include_in_scoped_context: ${policy.includeInScopedContext}`);
  lines.push(`policy_allow_legacy_unscoped_read: ${policy.allowLegacyUnscopedRead}`);
  lines.push(`policy_migrate_legacy_later: ${policy.migrateLegacyLater}`);
}

export function buildConfirmedMemorySavedMessage(saved) {
  const lines = [
    "✅ Confirmed project memory записана.",
    `id: ${saved?.id ?? "-"}`,
    `section: ${saved?.section ?? "-"}`,
    `entry_type: ${saved?.entry_type ?? "-"}`,
    `title: ${safeText(saved?.title) || "-"}`,
    `module_key: ${safeText(saved?.module_key) || "-"}`,
    `stage_key: ${safeText(saved?.stage_key) || "-"}`,
  ];

  appendConfirmedScopeLines(lines, saved);
  appendConfirmedPolicyLines(lines, saved);

  return lines.join("\n");
}

export function buildConfirmedMemoryUpdatedMessage(updated, fallbackId = null) {
  const lines = [
    "✅ Confirmed project memory обновлена.",
    `id: ${updated?.id ?? fallbackId ?? "-"}`,
    `section: ${updated?.section ?? "-"}`,
    `entry_type: ${updated?.entry_type ?? "-"}`,
    `title: ${safeText(updated?.title) || "-"}`,
    `module_key: ${safeText(updated?.module_key) || "-"}`,
    `stage_key: ${safeText(updated?.stage_key) || "-"}`,
  ];

  appendConfirmedScopeLines(lines, updated);
  appendConfirmedPolicyLines(lines, updated);

  return lines.join("\n");
}

export default {
  appendConfirmedScopeLines,
  appendConfirmedPolicyLines,
  buildConfirmedMemorySavedMessage,
  buildConfirmedMemoryUpdatedMessage,
};