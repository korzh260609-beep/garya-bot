// src/bot/handlers/pmConfirmedRender.js
// ============================================================================
// Project Memory confirmed render helpers
// Purpose:
// - shared Telegram rendering helpers for confirmed project memory rows
// - no business logic here
// - no policy decisions here
// - render metadata already returned by universal core/service layer
// - support both confirmed read rows and write/update rows
// - keep Telegram output compact and readable
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

function compactText(value, maxLength = 120) {
  const text = safeText(value);

  if (!text) return "-";
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}...`;
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

  lines.push(
    `${prefix}state: status=${safeText(row?.status) || "-"}, active=${boolLabel(row?.is_active)}`
  );
}

export function appendConfirmedScopeLines(lines, row, options = {}) {
  const scope = getScopeView(row);
  const prefix = safeText(options.prefix);
  const contextLabel = safeText(options.contextLabel) || "ai_context";

  lines.push(
    [
      `${prefix}scope:`,
      `area=${scope.area}`,
      `repo=${scope.repo}`,
      `cross_repo=${scope.crossRepo}`,
      `${contextLabel}=${scope.aiContext}`,
      `linked_areas=${scope.linkedAreas}`,
      `linked_repos=${scope.linkedRepos}`,
    ].join(" ")
  );
}

export function appendConfirmedPolicyLines(lines, row, options = {}) {
  const policy = getPolicyView(row);
  const prefix = safeText(options.prefix);

  if (options.skipEmpty === true && !hasConfirmedPolicyDiagnostics(row)) {
    return;
  }

  lines.push(
    [
      `${prefix}policy:`,
      `v=${policy.policyVersion}`,
      `req=${compactText(policy.requirement, 60)}`,
      `class=${compactText(policy.scopeClass, 60)}`,
      `write=${policy.validForWrite}`,
      `ctx=${policy.includeInScopedContext}`,
      `legacy_read=${policy.allowLegacyUnscopedRead}`,
      `migrate=${policy.migrateLegacyLater}`,
    ].join(" ")
  );

  if (options.verbose === true) {
    lines.push(`${prefix}policy_requirement_reason: ${compactText(policy.requirementReason, 160)}`);
    lines.push(`${prefix}policy_scope_class_reason: ${compactText(policy.scopeClassReason, 160)}`);
  }
}

export function buildConfirmedMemorySavedMessage(saved) {
  const lines = [
    "✅ Confirmed project memory записана.",
    `id: ${saved?.id ?? "-"}`,
    `section: ${saved?.section ?? "-"}`,
    `type: ${saved?.entry_type ?? "-"}`,
    `title: ${safeText(saved?.title) || "-"}`,
    `module: ${safeText(saved?.module_key) || "-"}`,
    `stage: ${safeText(saved?.stage_key) || "-"}`,
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
    `type: ${updated?.entry_type ?? "-"}`,
    `title: ${safeText(updated?.title) || "-"}`,
    `module: ${safeText(updated?.module_key) || "-"}`,
    `stage: ${safeText(updated?.stage_key) || "-"}`,
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