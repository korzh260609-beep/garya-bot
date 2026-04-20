// src/bot/handlers/pmLatest.js
// ============================================================================
// Project Memory latest work-session (read-only)
// Purpose:
// - show latest saved work session
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

function parseLatestArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  let moduleKey = "";
  let stageKey = "";

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
  }

  return {
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

function buildLatestMessage(row, timezone, filters) {
  const title = safeText(row.title) || "untitled session";
  const dateText = formatDateTime(row.updated_at || row.created_at, timezone);

  const goal = firstOrEmpty(extractBlockLines(row.content, "GOAL"));
  const changed = extractBlockLines(row.content, "CHANGED").slice(0, 2);
  const decisions = extractBlockLines(row.content, "DECISIONS").slice(0, 2);
  const risks = extractBlockLines(row.content, "RISKS").slice(0, 2);
  const nextSteps = extractBlockLines(row.content, "NEXT").slice(0, 2);
  const filterLabel = buildFilterLabel(filters);

  const lines = [
    `🧠 Project Memory latest${filterLabel}:`,
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
  rest = "",
  globalUserId = null,
  getProjectMemoryList,
}) {
  try {
    const timezone = await resolveDisplayTimezone(globalUserId);
    const args = parseLatestArgs(rest);

    const rows = await getProjectMemoryList(undefined, "work_sessions");
    const sessions = Array.isArray(rows)
      ? rows.filter((row) => String(row.entry_type || "") === "session_summary")
      : [];

    const filtered = filterSessions(sessions, args);

    if (!filtered.length) {
      const filterLabel = buildFilterLabel(args);
      await bot.sendMessage(chatId, `🧠 Project Memory latest${filterLabel}: записей пока нет.`);
      return;
    }

    const latest = filtered[0];
    const message = buildLatestMessage(latest, timezone, args);
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error("❌ /pm_latest error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения последней Project Memory session.");
  }
}

export default {
  handlePmLatest,
};