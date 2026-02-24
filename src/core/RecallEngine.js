// src/core/RecallEngine.js
// STAGE 8A — Recall Engine (safe, fail-open)
//
// Goal: build short recall context from DB history (NO AI, NO embeddings).
// Strategy:
// 1) If RECALL_ENABLED truthy => try fetch recent messages from chat_memory
// 2) Prefer scope: (chat_id + global_user_id)
// 3) Fallback scope: (chat_id only) if no rows found
// 4) Return compact text block (last N turns), else "".
//
// IMPORTANT:
// - Must never crash prod (fail-open => return "")
// - Must work even if global_user_id is null/missing
// - Must not depend on Postgres extensions
//
// B) Date-aware recall (minimal + universal):
// - Filter range is ALWAYS computed in UTC (stable, predictable).
// - Display/log range is also shown in Europe/Kyiv for human readability.
// - Supports: today/yesterday/day before yesterday, N days ago,
//   and "last week / прошлой неделе / минулого тижня" (previous calendar week).

import { createTimeContext } from "./time/timeContextFactory.js";

function envTruthy(v) {
  if (v === true) return true;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function safeTrim(s, max = 400) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function normalizeRole(role) {
  const r = String(role ?? "").toLowerCase();
  if (r === "user") return "user";
  if (r === "assistant") return "assistant";
  if (r === "system") return "system";
  return r || "unknown";
}

function startOfUTCDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addDaysUTC(d, days) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + Number(days || 0));
  return x;
}

// ISO-like week start (Monday 00:00 UTC)
function startOfUTCWeekMonday(d) {
  const dayStart = startOfUTCDay(d);
  const dow = dayStart.getUTCDay(); // 0=Sun..6=Sat
  const delta = (dow + 6) % 7; // Mon->0, Tue->1, ... Sun->6
  return addDaysUTC(dayStart, -delta);
}

function formatInKyiv(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(dt);
  } catch (_) {
    return null;
  }
}

function parseRelativeDayRangeUTC(query) {
  try {
    const q = String(query || "").toLowerCase();
    const now = new Date();

    if (
      /\blast\s+week\b/.test(q) ||
      q.includes("прошлая неделя") ||
      q.includes("прошлую неделю") ||
      q.includes("прошлой неделе") ||
      q.includes("прошлой недели") ||
      q.includes("на прошлой неделе") ||
      q.includes("за прошлую неделю") ||
      q.includes("минулий тиждень") ||
      q.includes("минулого тижня") ||
      q.includes("минулому тижні") ||
      q.includes("на минулому тижні")
    ) {
      const thisWeekStart = startOfUTCWeekMonday(now);
      const from = addDaysUTC(thisWeekStart, -7);
      const to = thisWeekStart;
      return { from, to, hint: "last_week" };
    }

    if (q.includes("сегодня") || q.includes("сьогодні") || /\btoday\b/.test(q)) {
      const from = startOfUTCDay(now);
      const to = startOfUTCDay(addDaysUTC(now, 1));
      return { from, to, hint: "today" };
    }

    if (q.includes("вчера") || q.includes("вчора") || /\byesterday\b/.test(q)) {
      const from = startOfUTCDay(addDaysUTC(now, -1));
      const to = startOfUTCDay(now);
      return { from, to, hint: "yesterday" };
    }

    if (
      q.includes("позавчера") ||
      q.includes("позавчора") ||
      /\bday\s+before\s+yesterday\b/.test(q)
    ) {
      const from = startOfUTCDay(addDaysUTC(now, -2));
      const to = startOfUTCDay(addDaysUTC(now, -1));
      return { from, to, hint: "day_before_yesterday" };
    }

    let m = q.match(/\b(\d{1,2})\s*days?\s*ago\b/);
    if (m && m[1]) {
      const n = Math.max(0, Math.min(30, Number(m[1])));
      const from = startOfUTCDay(addDaysUTC(now, -n));
      const to = startOfUTCDay(addDaysUTC(now, -n + 1));
      return { from, to, hint: `${n}_days_ago` };
    }

    m = q.match(/(\d{1,2})\s*(дн(?:ей|я)|дні|днів)\s*назад/iu);
    if (m && m[1]) {
      const n = Math.max(0, Math.min(30, Number(m[1])));
      const from = startOfUTCDay(addDaysUTC(now, -n));
      const to = startOfUTCDay(addDaysUTC(now, -n + 1));
      return { from, to, hint: `${n}_days_ago` };
    }

    return null;
  } catch (_) {
    return null;
  }
}

export class RecallEngine {
  constructor({ db, logger }) {
    this.db = db;
    this.logger = logger || console;
  }

  async buildRecallContext({ chatId, globalUserId = null, query = "", limit = 5 }) {
    try {
      const enabled = envTruthy(process.env.RECALL_ENABLED);
      if (!enabled) return "";

      const lim = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(20, Number(limit))) : 5;

      const chatIdStr = chatId != null ? String(chatId) : null;
      const globalStr = globalUserId != null ? String(globalUserId) : null;

      if (!chatIdStr) return "";

      // STAGE 8 — TimeContext wiring (no logic yet)
      const timeCtx = createTimeContext({
        userTimezoneFromDb: null,
      });

      const range = parseRelativeDayRangeUTC(query);
      const useRange = Boolean(range && range.from && range.to);

      let rows = [];
      let scope = "chat_only";

      if (globalStr) {
        try {
          const params = [chatIdStr, globalStr];
          let sql = `
            SELECT role, content, created_at
            FROM chat_memory
            WHERE chat_id = $1 AND global_user_id = $2
          `;

          if (useRange) {
            params.push(range.from);
            params.push(range.to);
            sql += ` AND created_at >= $3 AND created_at < $4`;
          }

          params.push(lim * 6);
          sql += `
            ORDER BY created_at DESC
            LIMIT $${params.length}
          `;

          const r1 = await this.db.query(sql, params);
          rows = r1?.rows || [];
          scope = "chat+global";
        } catch (e) {
          try {
            this.logger.error("❌ RecallEngine DB query (chat+global) failed:", e?.message || e);
          } catch (_) {}
          rows = [];
        }
      }

      if (!rows || rows.length === 0) {
        try {
          const params = [chatIdStr];
          let sql = `
            SELECT role, content, created_at
            FROM chat_memory
            WHERE chat_id = $1
          `;

          if (useRange) {
            params.push(range.from);
            params.push(range.to);
            sql += ` AND created_at >= $2 AND created_at < $3`;
          }

          params.push(lim * 6);
          sql += `
            ORDER BY created_at DESC
            LIMIT $${params.length}
          `;

          const r2 = await this.db.query(sql, params);
          rows = r2?.rows || [];
          scope = "chat_only";
        } catch (e) {
          try {
            this.logger.error("❌ RecallEngine DB query (chat_only) failed:", e?.message || e);
          } catch (_) {}
          return "";
        }
      }

      try {
        this.logger.log("🧠 RECALL_ENGINE_ROWS", {
          scope,
          chatId: chatIdStr,
          globalUserId: globalStr,
          rows: Array.isArray(rows) ? rows.length : 0,
          q: String(query || "").slice(0, 80),
          dateFilter: useRange
            ? {
                hint: range?.hint || null,
                from_utc: range?.from ? new Date(range.from).toISOString() : null,
                to_utc: range?.to ? new Date(range.to).toISOString() : null,
                from_kyiv: range?.from ? formatInKyiv(range.from) : null,
                to_kyiv: range?.to ? formatInKyiv(range.to) : null,
                tz_note: "filter=UTC, display=Europe/Kyiv",
              }
            : null,
        });
      } catch (_) {}

      if (!rows || rows.length === 0) return "";

      const asc = [...rows].reverse();

      const lines = [];
      for (const r of asc) {
        const role = normalizeRole(r.role);
        if (role === "system") continue;

        const text = safeTrim(r.content, 500);
        if (!text) continue;

        const prefix = role === "user" ? "U:" : role === "assistant" ? "A:" : `${role}:`;
        lines.push(`${prefix} ${text}`);

        if (lines.length >= lim * 2) break;
      }

      if (lines.length === 0) return "";

      const header = `Последние сообщения (контекст памяти):`;
      return [header, ...lines].join("\n");
    } catch (e) {
      try {
        this.logger.error("❌ RecallEngine buildRecallContext failed:", e?.message || e);
      } catch (_) {}
      return "";
    }
  }
}
