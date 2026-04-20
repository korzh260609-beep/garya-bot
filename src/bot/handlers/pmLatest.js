// src/bot/handlers/pmLatest.js
// ============================================================================
// Project Memory latest work-session (read-only)
// TEMP DIAGNOSTIC VERSION
// Purpose:
// - show latest saved work session
// - safe/manual read access only
// - no auto-capture
// - no auto-analysis
// - no DB writes
// - temporary debug markers to detect silent runtime path
// ============================================================================

import { getUserTimezone } from "../../db/userSettings.js";
import { resolveUserTimezone } from "../../core/time/timezoneResolver.js";

function safeText(value) {
  return String(value ?? "").trim();
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

function extractBlockLines(content = "", blockName = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const target = safeText(blockName).toUpperCase() + ":";

  let inBlock = false;
  const out = [];

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

    out.push(trimmed.replace(/^[-*•]\s*/, ""));
  }

  return out;
}

function firstOrEmpty(arr) {
  return Array.isArray(arr) && arr.length ? safeText(arr[0]) : "";
}

function buildLatestMessage(row, timezone) {
  const title = safeText(row.title) || "untitled session";
  const dateText = formatDateTime(row.updated_at || row.created_at, timezone);

  const goal = firstOrEmpty(extractBlockLines(row.content, "GOAL"));
  const changed = extractBlockLines(row.content, "CHANGED").slice(0, 2);
  const decisions = extractBlockLines(row.content, "DECISIONS").slice(0, 2);
  const risks = extractBlockLines(row.content, "RISKS").slice(0, 2);
  const nextSteps = extractBlockLines(row.content, "NEXT").slice(0, 2);

  const lines = [
    "🧠 Project Memory latest:",
    "",
    `id: ${row.id}`,
    `title: ${title}`,
    `date: ${dateText}`,
  ];

  if (goal) {
    lines.push(`goal: ${goal}`);
  }

  if (changed.length) {
    lines.push(`changed: ${changed.join(" | ")}`);
  }

  if (decisions.length) {
    lines.push(`decisions: ${decisions.join(" | ")}`);
  }

  if (risks.length) {
    lines.push(`risks: ${risks.join(" | ")}`);
  }

  if (nextSteps.length) {
    lines.push(`next: ${nextSteps.join(" | ")}`);
  }

  lines.push("");
  lines.push(`Используй: /pm_session_show ${row.id}`);

  return lines.join("\n").trim();
}

export async function handlePmLatest({
  bot,
  chatId,
  globalUserId = null,
  getProjectMemoryList,
}) {
  try {
    await bot.sendMessage(chatId, "🧪 /pm_latest debug: handler entered");

    const timezone = await resolveDisplayTimezone(globalUserId);

    await bot.sendMessage(
      chatId,
      `🧪 /pm_latest debug: timezone resolved = ${safeText(timezone) || "UTC"}`
    );

    const rows = await getProjectMemoryList(undefined, "work_sessions");

    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    await bot.sendMessage(
      chatId,
      `🧪 /pm_latest debug: rows=${Array.isArray(rows) ? rows.length : 0}, sessions=${sessions.length}`
    );

    if (!sessions.length) {
      await bot.sendMessage(chatId, "🧠 Project Memory latest: записей пока нет.");
      return;
    }

    const latest = sessions[0];

    await bot.sendMessage(
      chatId,
      `🧪 /pm_latest debug: latest id=${safeText(latest?.id) || "-"}`
    );

    const message = buildLatestMessage(latest, timezone);
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error("❌ /pm_latest error:", e);

    const details =
      e && typeof e === "object"
        ? `${safeText(e.name)}: ${safeText(e.message)}`
        : safeText(e);

    await bot.sendMessage(
      chatId,
      `⚠️ Ошибка чтения последней Project Memory session.\n${details || "unknown error"}`
    );
  }
}

export default {
  handlePmLatest,
};