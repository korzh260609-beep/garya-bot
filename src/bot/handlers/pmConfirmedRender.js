// src/bot/handlers/pmConfirmedRender.js
// ============================================================================
// Project Memory confirmed render helpers
// Purpose:
// - shared Telegram rendering helpers for confirmed project memory rows
// - no business logic here
// - no policy decisions here
// - render metadata already returned by universal core/service layer
// - support both confirmed read rows and write/update rows
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

function getPolicyDiagnostics(row) {
  return row?.policyDiagnostics &&
    typeof row.policyDiagnostics === "object" &&
    !Array.isArray(row.policyDiagnostics)
    ? row.policyDiagnostics
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
  const diagnostics = getPolicyDiagnostics(row);

  return {
    policyVersion:
      typeof diagnostics.policyVersion === "number"
        ? String(diagnostics.policyVersion)
        : typeof meta.confirmedScopePolicyVersion === "number"
          ? String(meta.confirmedScopePolicyVersion)
          : "-",

    requirement:
      safeText(diagnostics.requirement) ||
      safeText(meta.confirmedScopeRequirement) ||
      "-",

    requirementReason:
      safeText(diagnostics.requirementReason) ||
      safeText(meta.confirmedScopeRequirementReason) ||
      "-",

    scopeClass:
      safeText(diagnostics.scopeClass) ||
      safeText(meta.confirmedScopeClass) ||
      "-",

    scopeClassReason:
      safeText(diagnostics.scopeClassReason) ||
      safeText(meta.confirmedScopeClassReason) ||
      "-",

    validForWrite:
      typeof diagnostics.validForWrite === "boolean"
        ? boolLabel(diagnostics.validForWrite)
        : boolLabel(meta.confirmedScopeValidForWrite),

    includeInScopedContext:
      typeof diagnostics.includeInScopedContext === "boolean"
        ? boolLabel(diagnostics.includeInScopedContext)
        : boolLabel(meta.confirmedScopeIncludeInScopedContext),

    allowLegacyUnscopedRead:
      typeof diagnostics.allowLegacyUnscopedRead === "boolean"
        ? boolLabel(diagnostics.allowLegacyUnscopedRead)
        : boolLabel(meta.confirmedScopeAllowLegacyUnscopedRead),

    migrateLegacyLater:
      typeof diagnostics.migrateLegacyLater === "boolean"
        ? boolLabel(diagnostics.migrateLegacyLater)
        : boolLabel(meta.confirmedScopeMigrateLegacyLater),
  };
}

export function hasConfirmedPolicyDiagnostics(row) {
  const policy = getPolicyView(row);

  return (
    policy.policyVersion !== "-" ||
    policy.requirement !== "-" ||
    policy.requirementReason !== "-" ||
    policy.scopeClass !== "-" ||
    policy.scopeClassReason !== "-" ||
    policy.validForWrite !== "-" ||
    policy.includeInScopedContext !== "-" ||
    policy.allowLegacyUnscopedRead !== "-" ||
    policy.migrateLegacyLater !== "-"
  );
}

export function appendConfirmedStateLines(lines, row, options = {}) {
  const prefix = safeText(options.prefix);

  lines.push(`${prefix}status: ${safeText(row?.status) || "-"}`);
  lines.push(`${prefix}is_active: ${boolLabel(row?.is_active)}`);
}

export function appendConfirmedScopeLines(lines, row, options = {}) {
  const scope = getScopeView(row);
  const prefix = safeText(options.prefix);
  const contextLabel = safeText(options.contextLabel) || "ai_context";

  lines.push(`${prefix}area: ${scope.area}`);
  lines.push(`${prefix}repo: ${scope.repo}`);
  lines.push(`${prefix}linked_areas: ${scope.linkedAreas}`);
  lines.push(`${prefix}linked_repos: ${scope.linkedRepos}`);
  lines.push(`${prefix}cross_repo: ${scope.crossRepo}`);
  lines.push(`${prefix}${contextLabel}: ${scope.aiContext}`);
}

export function appendConfirmedPolicyLines(lines, row, options = {}) {
  const policy = getPolicyView(row);
  const prefix = safeText(options.prefix);

  if (options.skipEmpty === true && !hasConfirmedPolicyDiagnostics(row)) {
    return;
  }

  lines.push(`${prefix}policy_version: ${policy.policyVersion}`);
  lines.push(`${prefix}policy_requirement: ${policy.requirement}`);
  lines.push(`${prefix}policy_requirement_reason: ${policy.requirementReason}`);
  lines.push(`${prefix}policy_scope_class: ${policy.scopeClass}`);
  lines.push(`${prefix}policy_scope_class_reason: ${policy.scopeClassReason}`);
  lines.push(`${prefix}policy_valid_for_write: ${policy.validForWrite}`);
  lines.push(`${prefix}policy_include_in_scoped_context: ${policy.includeInScopedContext}`);
  lines.push(`${prefix}policy_allow_legacy_unscoped_read: ${policy.allowLegacyUnscopedRead}`);
  lines.push(`${prefix}policy_migrate_legacy_later: ${policy.migrateLegacyLater}`);
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

  appendConfirmedStateLines(lines, saved);
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

  appendConfirmedStateLines(lines, updated);
  appendConfirmedScopeLines(lines, updated);
  appendConfirmedPolicyLines(lines, updated);

  return lines.join("\n");
}

export default {
  appendConfirmedStateLines,
  appendConfirmedScopeLines,
  appendConfirmedPolicyLines,
  hasConfirmedPolicyDiagnostics,
  buildConfirmedMemorySavedMessage,
  buildConfirmedMemoryUpdatedMessage,
};