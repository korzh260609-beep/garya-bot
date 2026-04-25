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
import {
  safeText,
  formatDateTime,
  extractBlockLines,
  firstOrEmpty,
  filterSessionsByModuleStage,
  buildFilterLabel,
} from "./projectMemoryReadRenderUtils.js";

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

    const filtered = filterSessionsByModuleStage(sessions, args);

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
