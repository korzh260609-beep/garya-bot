// src/bot/handlers/pmDigest.js
// ============================================================================
// Project Memory digest (read-only)
// Purpose:
// - compact summary of latest work sessions
// - safe/manual read access only
// - no auto-capture
// - no auto-analysis
// - no DB writes
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

function buildDigestMessage(rows, limit, timezone) {
  if (!rows.length) {
    return "🧠 Project Memory digest: записей пока нет.";
  }

  const slice = rows.slice(0, limit);

  const lines = [
    `🧠 Project Memory digest (последние ${slice.length}):`,
    "",
  ];

  for (const row of slice) {
    const title = safeText(row.title) || "untitled session";
    const dateText = formatDateTime(row.updated_at || row.created_at, timezone);

    const goal = firstOrEmpty(extractBlockLines(row.content, "GOAL"));
    const changed = extractBlockLines(row.content, "CHANGED").slice(0, 2);
    const decisions = extractBlockLines(row.content, "DECISIONS").slice(0, 2);
    const risks = extractBlockLines(row.content, "RISKS").slice(0, 2);
    const nextSteps = extractBlockLines(row.content, "NEXT").slice(0, 2);

    lines.push(`• id=${row.id} | ${title}`);
    lines.push(`  date: ${dateText}`);

    if (goal) {
      lines.push(`  goal: ${goal}`);
    }

    if (changed.length) {
      lines.push(`  changed: ${changed.join(" | ")}`);
    }

    if (decisions.length) {
      lines.push(`  decisions: ${decisions.join(" | ")}`);
    }

    if (risks.length) {
      lines.push(`  risks: ${risks.join(" | ")}`);
    }

    if (nextSteps.length) {
      lines.push(`  next: ${nextSteps.join(" | ")}`);
    }

    lines.push("");
  }

  lines.push("Используй: /pm_session_show <id>");

  const text = lines.join("\n").trim();
  return text.length > 3800 ? text.slice(0, 3800) + "\n…(обрезано)" : text;
}

export async function handlePmDigest({
  bot,
  chatId,
  rest,
  globalUserId = null,
  getProjectMemoryList,
}) {
  const raw = safeText(rest);

  try {
    const timezone = await resolveDisplayTimezone(globalUserId);
    const limit = raw ? toPositiveInt(raw, 5, 1, 20) : 5;

    const rows = await getProjectMemoryList(undefined, "work_sessions");
    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    const message = buildDigestMessage(sessions, limit, timezone);
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error("❌ /pm_digest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory digest.");
  }
}

export default {
  handlePmDigest,
};