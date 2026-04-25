// src/bot/handlers/pmFind.js
// ============================================================================
// Project Memory find (read-only)
// Purpose:
// - search latest work sessions by text
// - safe/manual read access only
// - no auto-capture
// - no auto-analysis
// - no DB writes
// - supports filters: module:<key> stage:<key>
// ============================================================================

import { getUserTimezone } from "../../db/userSettings.js";
import { resolveUserTimezone } from "../../core/time/timezoneResolver.js";
import {
  safeText,
  formatDateTime,
  extractFirstBlockLine,
  filterSessionsByModuleStage,
  buildFilterLabel,
} from "./projectMemoryReadRenderUtils.js";

function normalizeSearchText(value) {
  return safeText(value).toLowerCase();
}

function parseFindArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  let moduleKey = "";
  let stageKey = "";
  const queryTokens = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower.startsWith("module:")) {
      moduleKey = safeText(token.slice(7));
      continue;
    }

    if (lower.startsWith("stage:")) {
      stageKey = safeText(token.slice(6));
      continue;
    }

    queryTokens.push(token);
  }

  return {
    query: safeText(queryTokens.join(" ")),
    moduleKey,
    stageKey,
  };
}

async function resolveDisplayTimezone(globalUserId) {
  let userTimezoneFromDb = null;

  try {
    if (globalUserId) {
      const tzInfo = await getUserTimezone(globalUserId);
      if (tzInfo?.isSet === true && safeText(tzInfo.timezone)) {
        userTimezoneFromDb = safeText(tzInfo.timezone);
      }
    }
  } catch (_) {
    // fail-open
  }

  try {
    return resolveUserTimezone({ userTimezoneFromDb });
  } catch (_) {
    return "UTC";
  }
}

function matchesQuery(row, q) {
  const title = normalizeSearchText(row?.title);
  const content = normalizeSearchText(row?.content);

  return title.includes(q) || content.includes(q);
}

function buildFindMessage(rows, query, timezone, filters) {
  const filterLabel = buildFilterLabel(filters);

  if (!rows.length) {
    return `🧠 Project Memory find${filterLabel}: ничего не найдено по запросу "${query}".`;
  }

  const lines = [
    `🧠 Project Memory find${filterLabel}: "${query}"`,
    "",
  ];

  for (const row of rows.slice(0, 10)) {
    const title = safeText(row.title) || "untitled session";
    const dateText = formatDateTime(row.updated_at || row.created_at, timezone);
    const goal = extractFirstBlockLine(row.content, "GOAL");
    const changed = extractFirstBlockLine(row.content, "CHANGED");

    lines.push(`• id=${row.id} | ${title}`);
    lines.push(`  date: ${dateText}`);

    if (goal) {
      lines.push(`  goal: ${goal}`);
    }

    if (changed) {
      lines.push(`  changed: ${changed}`);
    }

    lines.push("");
  }

  lines.push("Используй: /pm_session_show <id>");

  const text = lines.join("\n").trim();
  return text.length > 3800 ? text.slice(0, 3800) + "\n…(обрезано)" : text;
}

export async function handlePmFind({
  bot,
  chatId,
  rest,
  globalUserId = null,
  getProjectMemoryList,
}) {
  const args = parseFindArgs(rest);

  if (!args.query) {
    await bot.sendMessage(chatId, "Использование: /pm_find <текст> [module:<key>] [stage:<key>]");
    return;
  }

  try {
    const timezone = await resolveDisplayTimezone(globalUserId);

    const rows = await getProjectMemoryList(undefined, "work_sessions");
    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    const filtered = filterSessionsByModuleStage(sessions, args);
    const q = normalizeSearchText(args.query);
    const matched = filtered.filter((row) => matchesQuery(row, q));

    const message = buildFindMessage(matched, args.query, timezone, args);
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error("❌ /pm_find error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка поиска по Project Memory.");
  }
}

export default {
  handlePmFind,
};
