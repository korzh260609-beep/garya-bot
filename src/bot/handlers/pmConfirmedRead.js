// src/bot/handlers/pmConfirmedRead.js
// ============================================================================
// Project Memory confirmed read flow
// Purpose:
// - thin Telegram adapter for confirmed project memory reads
// - no business logic here
// - call universal confirmed reader and render simple text
// - render additive policy diagnostics already prepared by core reader
// ============================================================================

import {
  appendConfirmedScopeLines,
  appendConfirmedPolicyLines,
} from "./pmConfirmedRender.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function parseArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  const out = {
    limit: null,
    moduleKey: null,
    stageKey: null,
    section: null,
    entryType: null,
    aiContext: undefined,
    projectArea: null,
    repoScope: null,
    linkedArea: null,
    linkedRepo: null,
    crossRepo: undefined,
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (/^\d+$/.test(token)) {
      out.limit = Number.parseInt(token, 10);
      continue;
    }

    if (lower.startsWith("module:")) {
      out.moduleKey = safeText(token.slice(7));
      continue;
    }

    if (lower.startsWith("stage:")) {
      out.stageKey = safeText(token.slice(6));
      continue;
    }

    if (lower.startsWith("section:")) {
      out.section = safeText(token.slice(8));
      continue;
    }

    if (lower.startsWith("type:")) {
      out.entryType = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("context:")) {
      out.aiContext = parseBooleanLike(token.slice(8), undefined);
      continue;
    }

    if (lower.startsWith("area:")) {
      out.projectArea = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("repo:")) {
      out.repoScope = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("linked_area:")) {
      out.linkedArea = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("linked_repo:")) {
      out.linkedRepo = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("cross_repo:")) {
      out.crossRepo = parseBooleanLike(token.slice(11), undefined);
      continue;
    }
  }

  return out;
}

function buildFilterLabel(args = {}) {
  const parts = [];

  if (args.moduleKey) parts.push(`module=${args.moduleKey}`);
  if (args.stageKey) parts.push(`stage=${args.stageKey}`);
  if (args.section) parts.push(`section=${args.section}`);
  if (args.entryType) parts.push(`type=${args.entryType}`);
  if (args.projectArea) parts.push(`area=${args.projectArea}`);
  if (args.repoScope) parts.push(`repo=${args.repoScope}`);
  if (args.linkedArea) parts.push(`linked_area=${args.linkedArea}`);
  if (args.linkedRepo) parts.push(`linked_repo=${args.linkedRepo}`);
  if (typeof args.crossRepo === "boolean") {
    parts.push(`cross_repo=${args.crossRepo ? "yes" : "no"}`);
  }
  if (typeof args.aiContext === "boolean") {
    parts.push(`context=${args.aiContext ? "yes" : "no"}`);
  }

  return parts.length ? `[${parts.join(", ")}]` : "";
}

function compactText(text, maxChars = 220) {
  const s = safeText(text);
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "...";
}

async function sendChunked(bot, chatId, title, content) {
  const SAFE_LIMIT = 3800;
  const header = safeText(title);
  const text = String(content ?? "");

  if (!text) {
    await bot.sendMessage(chatId, header || "Пусто.");
    return;
  }

  const full = header ? `${header}\n\n${text}` : text;

  if (full.length <= SAFE_LIMIT) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const parts = [];
  let cursor = 0;

  while (cursor < text.length) {
    parts.push(text.slice(cursor, cursor + 3000));
    cursor += 3000;
  }

  for (let i = 0; i < parts.length; i++) {
    const prefix = header
      ? `${header}\nчасть ${i + 1}/${parts.length}\n\n`
      : `часть ${i + 1}/${parts.length}\n\n`;

    const available = Math.max(500, SAFE_LIMIT - prefix.length);
    const body = parts[i].slice(0, available);

    await bot.sendMessage(chatId, prefix + body);
  }
}

function buildListMessage(rows, args = {}) {
  const filterLabel = buildFilterLabel(args);

  if (!rows.length) {
    return `🧠 Confirmed memory ${filterLabel || ""}: записей нет.`.trim();
  }

  const lines = [`🧠 Confirmed memory ${filterLabel || ""} (последние ${rows.length}):`.trim(), ""];

  for (const row of rows) {
    lines.push(`• id=${row.id} | ${safeText(row.entry_type)} | ${safeText(row.section) || "-"}`);

    appendConfirmedScopeLines(lines, row, {
      prefix: "  ",
      contextLabel: "context",
    });

    appendConfirmedPolicyLines(lines, row, {
      prefix: "  ",
      skipEmpty: true,
    });

    if (safeText(row.title)) {
      lines.push(`  title: ${safeText(row.title)}`);
    }

    lines.push(`  text: ${compactText(row.content)}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildLatestMessage(row, args = {}) {
  const filterLabel = buildFilterLabel(args);

  const lines = [
    `🧠 Confirmed latest ${filterLabel || ""}:`.trim(),
    "",
    `id: ${row.id}`,
    `entry_type: ${safeText(row.entry_type) || "-"}`,
    `section: ${safeText(row.section) || "-"}`,
    `title: ${safeText(row.title) || "-"}`,
    `module_key: ${safeText(row.module_key) || "-"}`,
    `stage_key: ${safeText(row.stage_key) || "-"}`,
  ];

  appendConfirmedScopeLines(lines, row, {
    prefix: "",
    contextLabel: "ai_context",
  });

  appendConfirmedPolicyLines(lines, row, {
    prefix: "",
    skipEmpty: true,
  });

  lines.push("");
  lines.push(safeText(row.content) || "-");

  return lines.join("\n");
}

export async function handlePmConfirmedList({
  bot,
  chatId,
  rest,
  listConfirmedProjectMemoryEntries,
}) {
  if (typeof listConfirmedProjectMemoryEntries !== "function") {
    await bot.sendMessage(chatId, "⛔ listConfirmedProjectMemoryEntries недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);
    const limit = Number.isInteger(args.limit) ? args.limit : 10;

    const rows = await listConfirmedProjectMemoryEntries({
      limit,
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
      aiContext: args.aiContext,
      projectArea: args.projectArea,
      repoScope: args.repoScope,
      linkedArea: args.linkedArea,
      linkedRepo: args.linkedRepo,
      crossRepo: args.crossRepo,
    });

    await sendChunked(bot, chatId, "", buildListMessage(rows, args));
  } catch (e) {
    console.error("❌ /pm_confirmed_list error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения confirmed project memory.");
  }
}

export async function handlePmConfirmedLatest({
  bot,
  chatId,
  rest,
  getLatestConfirmedProjectMemoryEntry,
}) {
  if (typeof getLatestConfirmedProjectMemoryEntry !== "function") {
    await bot.sendMessage(chatId, "⛔ getLatestConfirmedProjectMemoryEntry недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);

    const row = await getLatestConfirmedProjectMemoryEntry({
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
      aiContext: args.aiContext,
      projectArea: args.projectArea,
      repoScope: args.repoScope,
      linkedArea: args.linkedArea,
      linkedRepo: args.linkedRepo,
      crossRepo: args.crossRepo,
    });

    const filterLabel = buildFilterLabel(args);

    if (!row) {
      await bot.sendMessage(chatId, `🧠 Confirmed latest ${filterLabel || ""}: записей нет.`.trim());
      return;
    }

    const text = buildLatestMessage(row, args);
    await sendChunked(bot, chatId, "", text);
  } catch (e) {
    console.error("❌ /pm_confirmed_latest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения latest confirmed memory.");
  }
}

export async function handlePmConfirmedDigest({
  bot,
  chatId,
  rest,
  buildConfirmedProjectMemoryDigest,
}) {
  if (typeof buildConfirmedProjectMemoryDigest !== "function") {
    await bot.sendMessage(chatId, "⛔ buildConfirmedProjectMemoryDigest недоступен.");
    return;
  }

  try {
    const args = parseArgs(rest);

    const digest = await buildConfirmedProjectMemoryDigest({
      limit: Number.isInteger(args.limit) ? args.limit : 50,
      moduleKey: args.moduleKey,
      stageKey: args.stageKey,
      section: args.section,
      entryType: args.entryType,
      aiContext: args.aiContext,
      projectArea: args.projectArea,
      repoScope: args.repoScope,
      linkedArea: args.linkedArea,
      linkedRepo: args.linkedRepo,
      crossRepo: args.crossRepo,
    });

    const lines = [
      `🧠 Confirmed digest ${buildFilterLabel(args) || ""}:`.trim(),
      "",
      `total: ${digest.totalEntries}`,
      `ai_context_total: ${digest.aiContextEligibleTotal}`,
      `cross_repo_total: ${digest.crossRepoTotal}`,
      `areas: ${(digest.projectAreas || []).join(", ") || "-"}`,
      `repos: ${(digest.repoScopes || []).join(", ") || "-"}`,
      `linked_areas: ${(digest.linkedAreas || []).join(", ") || "-"}`,
      `linked_repos: ${(digest.linkedRepoScopes || []).join(", ") || "-"}`,
      `sections: ${(digest.sections || []).join(", ") || "-"}`,
      `types: ${(digest.entryTypes || []).join(", ") || "-"}`,
      `modules: ${(digest.moduleKeys || []).join(", ") || "-"}`,
      `stages: ${(digest.stageKeys || []).join(", ") || "-"}`,
      `paths: ${(digest.relatedPaths || []).slice(0, 10).join(", ") || "-"}`,
      "",
      `policy_diagnostics_total: ${digest.policyDiagnosticsTotal ?? 0}`,
      `policy_valid_for_write_true_total: ${digest.policyValidForWriteTrueTotal ?? 0}`,
      `policy_valid_for_write_false_total: ${digest.policyValidForWriteFalseTotal ?? 0}`,
      `policy_include_in_scoped_context_true_total: ${digest.policyIncludeInScopedContextTrueTotal ?? 0}`,
      `policy_allow_legacy_unscoped_read_true_total: ${digest.policyAllowLegacyUnscopedReadTrueTotal ?? 0}`,
      `policy_migrate_legacy_later_true_total: ${digest.policyMigrateLegacyLaterTrueTotal ?? 0}`,
      `policy_versions: ${(digest.policyVersions || []).join(", ") || "-"}`,
      `policy_requirements: ${(digest.policyRequirements || []).join(", ") || "-"}`,
      `policy_scope_classes: ${(digest.policyScopeClasses || []).join(", ") || "-"}`,
    ];

    await sendChunked(bot, chatId, "", lines.join("\n"));
  } catch (e) {
    console.error("❌ /pm_confirmed_digest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения confirmed digest.");
  }
}

export default {
  handlePmConfirmedList,
  handlePmConfirmedLatest,
  handlePmConfirmedDigest,
};