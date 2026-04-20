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

function safeText(value) {
  return String(value ?? "").trim();
}

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

function formatDateTimeLegacy(value) {
  if (!value) return "unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function formatDateTime(value, timezone = "UTC") {
  if (!value) return "unknown";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  try {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(",", "");
  } catch (_) {
    return formatDateTimeLegacy(d);
  }
}

function extractFirstBlockLine(content = "", blockName = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const target = safeText(blockName).toUpperCase() + ":";

  let inBlock = false;
  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const trimmed = line.trim();

    if (!inBlock) {
      if (trimmed.toUpperCase() === target) {
        inBlock = true;
      }
      continue;
    }

    if (!trimmed) continue;

    if (/^[A-Z_ ]+:$/.test(trimmed)) {
      break;
    }

    return trimmed.replace(/^[-*•]\s*/, "");
  }

  return "";
}

function matchesQuery(row, q) {
  const title = normalizeSearchText(row?.title);
  const content = normalizeSearchText(row?.content);

  return title.includes(q) || content.includes(q);
}

function filterSessions(rows, { moduleKey, stageKey }) {
  return rows.filter((row) => {
    if (moduleKey && safeText(row.module_key) !== moduleKey) {
      return false;
    }

    if (stageKey && safeText(row.stage_key) !== stageKey) {
      return false;
    }

    return true;
  });
}

function buildFilterLabel({ moduleKey, stageKey }) {
  const parts = [];

  if (moduleKey) parts.push(`module=${moduleKey}`);
  if (stageKey) parts.push(`stage=${stageKey}`);

  return parts.length ? ` [${parts.join(", ")}]` : "";
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

    const filtered = filterSessions(sessions, args);
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