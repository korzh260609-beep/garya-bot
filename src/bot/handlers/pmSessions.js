// src/bot/handlers/pmSessions.js
// ============================================================================
// Project Memory work-session read flow
// Purpose:
// - safe/manual read access for saved work sessions
// - no automatic chat capture or auto-analysis
// - uses existing project memory facade only
// - display time is formatted in resolved user timezone when available
// ============================================================================

import { getUserTimezone } from "../../db/userSettings.js";
import { resolveUserTimezone } from "../../core/time/timezoneResolver.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function toPositiveInt(value, def = 5, min = 1, max = 20) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
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

function buildListMessage(rows, limit, timezone) {
  if (!rows.length) {
    return "🧠 Work sessions: записей пока нет.";
  }

  const lines = [
    `🧠 Work sessions (последние ${Math.min(limit, rows.length)}):`,
    "",
  ];

  for (const row of rows.slice(0, limit)) {
    const title = safeText(row.title) || "untitled session";
    const goal = extractFirstBlockLine(row.content, "GOAL");
    const changed = extractFirstBlockLine(row.content, "CHANGED");
    const dateText = formatDateTime(row.updated_at || row.created_at, timezone);

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

  return lines.join("\n").trim();
}

function buildShowMessage(row, timezone) {
  const header = [
    "🧠 Work session",
    `id: ${row.id}`,
    `title: ${safeText(row.title) || "untitled session"}`,
    `date: ${formatDateTime(row.updated_at || row.created_at, timezone)}`,
    `module_key: ${safeText(row.module_key) || "-"}`,
    `stage_key: ${safeText(row.stage_key) || "-"}`,
    `source_ref: ${safeText(row.source_ref) || "-"}`,
    "",
  ].join("\n");

  return header + String(row.content || "");
}

async function sendChunked(bot, chatId, title, content) {
  const SAFE_LIMIT = 3800;
  const text = String(content ?? "");
  const header = String(title ?? "").trim();

  if (!text) {
    await bot.sendMessage(chatId, header || "Пусто.");
    return;
  }

  if ((header.length + 2 + text.length) <= SAFE_LIMIT) {
    await bot.sendMessage(chatId, header ? `${header}\n\n${text}` : text);
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

export async function handlePmSessions({
  bot,
  chatId,
  rest,
  globalUserId = null,
  getProjectMemoryList,
}) {
  const raw = safeText(rest);

  try {
    const timezone = await resolveDisplayTimezone(globalUserId);

    const rows = await getProjectMemoryList(undefined, "work_sessions");
    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    if (!raw || raw.toLowerCase() === "list") {
      const limit = 5;
      const message = buildListMessage(sessions, limit, timezone);
      await bot.sendMessage(chatId, message);
      return;
    }

    const parts = raw.split(/\s+/).filter(Boolean);
    const mode = safeText(parts[0]).toLowerCase();

    if (mode === "list") {
      const limit = toPositiveInt(parts[1], 5, 1, 20);
      const message = buildListMessage(sessions, limit, timezone);
      await bot.sendMessage(chatId, message);
      return;
    }

    if (mode === "show") {
      const id = Number.parseInt(parts[1] || "", 10);

      if (!Number.isInteger(id)) {
        await bot.sendMessage(chatId, "Использование: /pm_sessions show <id>");
        return;
      }

      const row = sessions.find((item) => Number(item.id) === id);

      if (!row) {
        await bot.sendMessage(chatId, `Work-session id=${id} не найден.`);
        return;
      }

      const full = buildShowMessage(row, timezone);
      await sendChunked(bot, chatId, "🧠 Project Memory: work_session", full);
      return;
    }

    const fallbackLimit = toPositiveInt(parts[0], 5, 1, 20);
    const message = buildListMessage(sessions, fallbackLimit, timezone);
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error("❌ /pm_sessions error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения work sessions из Project Memory.");
  }
}

export async function handlePmSessionShow({
  bot,
  chatId,
  rest,
  globalUserId = null,
  getProjectMemoryList,
}) {
  const id = Number.parseInt(safeText(rest), 10);

  if (!Number.isInteger(id)) {
    await bot.sendMessage(chatId, "Использование: /pm_session_show <id>");
    return;
  }

  try {
    const timezone = await resolveDisplayTimezone(globalUserId);

    const rows = await getProjectMemoryList(undefined, "work_sessions");
    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    const row = sessions.find((item) => Number(item.id) === id);

    if (!row) {
      await bot.sendMessage(chatId, `Work-session id=${id} не найден.`);
      return;
    }

    const full = buildShowMessage(row, timezone);
    await sendChunked(bot, chatId, "🧠 Project Memory: work_session", full);
  } catch (e) {
    console.error("❌ /pm_session_show error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения work-session из Project Memory.");
  }
}

export default {
  handlePmSessions,
  handlePmSessionShow,
};