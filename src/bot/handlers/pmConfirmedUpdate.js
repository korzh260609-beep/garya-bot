// src/bot/handlers/pmConfirmedUpdate.js
// ============================================================================
// Project Memory confirmed update flow
// Purpose:
// - thin Telegram adapter for confirmed project memory updates
// - no business logic here
// - parse input -> validate -> call universal confirmed updater
// - render returned universal metadata without deciding policy in transport
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function splitItems(value = "") {
  return String(value ?? "")
    .split(/\s*\|\s*/)
    .map((item) => safeText(item))
    .filter(Boolean);
}

function pickLine(map, ...keys) {
  for (const key of keys) {
    if (safeText(map[key])) return safeText(map[key]);
  }
  return "";
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
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

function appendScopeLines(lines, row) {
  const scope = getScopeView(row);

  lines.push(`area: ${scope.area}`);
  lines.push(`repo: ${scope.repo}`);
  lines.push(`linked_areas: ${scope.linkedAreas}`);
  lines.push(`linked_repos: ${scope.linkedRepos}`);
  lines.push(`cross_repo: ${scope.crossRepo}`);
  lines.push(`ai_context: ${scope.aiContext}`);
}

function appendPolicyLines(lines, row) {
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

function buildUpdatedMessage(updated, fallbackId) {
  const lines = [
    "✅ Confirmed project memory обновлена.",
    `id: ${updated?.id ?? fallbackId ?? "-"}`,
    `section: ${updated?.section ?? "-"}`,
    `entry_type: ${updated?.entry_type ?? "-"}`,
    `title: ${safeText(updated?.title) || "-"}`,
    `module_key: ${safeText(updated?.module_key) || "-"}`,
    `stage_key: ${safeText(updated?.stage_key) || "-"}`,
  ];

  appendScopeLines(lines, updated);
  appendPolicyLines(lines, updated);

  return lines.join("\n");
}

function parseConfirmedUpdateInput(rest = "") {
  const text = safeText(rest);

  if (!text) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line ?? ""))
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return null;
  }

  const firstLine = safeText(lines[0]);
  const idMatch = firstLine.match(/^(\d+)\s*$/);

  if (!idMatch) {
    return null;
  }

  const id = Number.parseInt(idMatch[1], 10);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const map = {};

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.*)$/);

    if (!match) continue;

    const rawKey = safeText(match[1]).toLowerCase().replace(/\s+/g, "_");
    const rawValue = safeText(match[2]);

    map[rawKey] = rawValue;
  }

  const patch = {};

  const title = pickLine(map, "title", "name");
  if (title) patch.title = title;

  const content = pickLine(map, "content", "text", "body");
  if (content) patch.content = content;

  const moduleKey = pickLine(map, "module", "module_key");
  if (moduleKey) patch.moduleKey = moduleKey;

  const stageKey = pickLine(map, "stage", "stage_key");
  if (stageKey) patch.stageKey = stageKey;

  const sourceType = pickLine(map, "source_type");
  if (sourceType) patch.sourceType = sourceType;

  const sourceRef = pickLine(map, "source", "source_ref");
  if (sourceRef) patch.sourceRef = sourceRef;

  const status = pickLine(map, "status");
  if (status) patch.status = status;

  const tags = splitItems(pickLine(map, "tags", "tag"));
  if (tags.length) patch.tags = tags;

  const relatedPaths = splitItems(pickLine(map, "paths", "related_paths", "files"));
  if (relatedPaths.length) patch.relatedPaths = relatedPaths;

  const projectArea = pickLine(map, "area", "project_area");
  const repoScope = pickLine(map, "repo", "repo_scope");
  const linkedAreas = splitItems(pickLine(map, "linked_areas", "areas"));
  const linkedRepoScopes = splitItems(pickLine(map, "linked_repos", "linked_repo_scopes"));
  const crossRepo = parseBooleanLike(pickLine(map, "cross_repo"), undefined);
  const aiContext = parseBooleanLike(
    pickLine(map, "context", "ai_context", "use_in_context"),
    undefined
  );

  if (
    projectArea ||
    repoScope ||
    linkedAreas.length ||
    linkedRepoScopes.length ||
    typeof crossRepo === "boolean" ||
    typeof aiContext === "boolean"
  ) {
    patch.meta = {};
  }

  if (projectArea) patch.meta.projectArea = projectArea;
  if (repoScope) patch.meta.repoScope = repoScope;
  if (linkedAreas.length) patch.meta.linkedAreas = linkedAreas;
  if (linkedRepoScopes.length) patch.meta.linkedRepoScopes = linkedRepoScopes;
  if (typeof crossRepo === "boolean") patch.meta.crossRepo = crossRepo;
  if (typeof aiContext === "boolean") patch.aiContext = aiContext;

  return { id, patch };
}

function buildUsage() {
  return [
    "Использование: /pm_confirmed_update",
    "",
    "Первая строка: id записи",
    "Дальше только поля, которые нужно изменить.",
    "",
    "Пример:",
    "14",
    "title: Updated context rule",
    "content: AI context must use curated confirmed memory only.",
    "area: shared",
    "repo: shared",
    "cross_repo: yes",
    "linked_areas: core | client",
    "linked_repos: core | client",
    "context: yes",
    "module: project_memory",
    "stage: 7A",
    "",
    "Разделитель списков: |",
  ].join("\n");
}

export async function handlePmConfirmedUpdate({
  bot,
  chatId,
  rest,
  updateConfirmedProjectMemoryEntry,
}) {
  if (typeof updateConfirmedProjectMemoryEntry !== "function") {
    await bot.sendMessage(chatId, "⛔ updateConfirmedProjectMemoryEntry недоступен.");
    return;
  }

  const parsed = parseConfirmedUpdateInput(rest);

  if (!parsed) {
    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  if (!Object.keys(parsed.patch || {}).length) {
    await bot.sendMessage(chatId, "⚠️ Не указано ни одного поля для обновления.\n\n" + buildUsage());
    return;
  }

  try {
    const updated = await updateConfirmedProjectMemoryEntry({
      id: parsed.id,
      patch: parsed.patch,
    });

    await bot.sendMessage(chatId, buildUpdatedMessage(updated, parsed.id));
  } catch (e) {
    console.error("❌ /pm_confirmed_update error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка обновления confirmed project memory.");
  }
}

export default {
  handlePmConfirmedUpdate,
};