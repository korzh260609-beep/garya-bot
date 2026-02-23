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
// B) Date-aware recall (minimal):
// - If user query contains "вчера/сегодня/позавчера/Х дней назад" (UA/RU/EN basic),
//   apply created_at range filter.
// - ⚠️ Timezone note: uses server-local Date() boundaries (Render/Node). If DB/user
//   expects Kyiv boundaries, results may be off near midnight.

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

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + Number(days || 0));
  return x;
}

function parseRelativeDayRange(query) {
  try {
    const q = String(query || "").toLowerCase();

    const now = new Date();

    // today
    if (q.includes("сегодня") || q.includes("сьогодні") || /\btoday\b/.test(q)) {
      const from = startOfLocalDay(now);
      const to = startOfLocalDay(addDays(now, 1));
      return { from, to, hint: "today" };
    }

    // yesterday
    if (q.includes("вчера") || q.includes("вчора") || /\byesterday\b/.test(q)) {
      const from = startOfLocalDay(addDays(now, -1));
      const to = startOfLocalDay(now);
      return { from, to, hint: "yesterday" };
    }

    // day before yesterday
    if (
      q.includes("позавчера") ||
      q.includes("позавчора") ||
      /\bday\s+before\s+yesterday\b/.test(q)
    ) {
      const from = startOfLocalDay(addDays(now, -2));
      const to = startOfLocalDay(addDays(now, -1));
      return { from, to, hint: "day_before_yesterday" };
    }

    // "N days ago" (EN)
    let m = q.match(/\b(\d{1,2})\s*days?\s*ago\b/);
    if (m && m[1]) {
      const n = Math.max(0, Math.min(30, Number(m[1]))); // cap to avoid huge scans
      const from = startOfLocalDay(addDays(now, -n));
      const to = startOfLocalDay(addDays(now, -n + 1));
      return { from, to, hint: `${n}_days_ago` };
    }

    // "N дней назад" (RU/UA)
    m = q.match(/\b(\d{1,2})\s*(дн(ей|я)|дні|днів)\s*назад\b/);
    if (m && m[1]) {
      const n = Math.max(0, Math.min(30, Number(m[1])));
      const from = startOfLocalDay(addDays(now, -n));
      const to = startOfLocalDay(addDays(now, -n + 1));
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

      // B) optional date range from query
      const range = parseRelativeDayRange(query);
      const useRange = Boolean(range && range.from && range.to);

      // 1) Primary scope: chat_id + global_user_id (if provided)
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
          // Fail-open on query errors, but continue to fallback
          try {
            this.logger.error("❌ RecallEngine DB query (chat+global) failed:", e?.message || e);
          } catch (_) {}
          rows = [];
        }
      }

      // 2) Fallback: chat_id only
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

      // DEBUG: prove DB returns something
      try {
        this.logger.log("🧠 RECALL_ENGINE_ROWS", {
          scope,
          chatId: chatIdStr,
          globalUserId: globalStr,
          rows: Array.isArray(rows) ? rows.length : 0,
          q: String(query || "").slice(0, 60),
          dateFilter: useRange
            ? {
                hint: range?.hint || null,
                from: range?.from ? new Date(range.from).toISOString() : null,
                to: range?.to ? new Date(range.to).toISOString() : null,
              }
            : null,
        });
      } catch (_) {}

      if (!rows || rows.length === 0) return "";

      // We fetched DESC; turn to ASC for readable context
      const asc = [...rows].reverse();

      // Build compact "turn-like" lines (prefer user+assistant pairs)
      const lines = [];
      for (const r of asc) {
        const role = normalizeRole(r.role);
        if (role === "system") continue;

        const text = safeTrim(r.content, 500);
        if (!text) continue;

        const prefix = role === "user" ? "U:" : role === "assistant" ? "A:" : `${role}:`;
        lines.push(`${prefix} ${text}`);

        if (lines.length >= lim * 2) break; // approx N turns
      }

      if (lines.length === 0) return "";

      const header = `Последние сообщения (контекст памяти):`;
      return [header, ...lines].join("\n");
    } catch (e) {
      // fail-open
      try {
        this.logger.error("❌ RecallEngine buildRecallContext failed:", e?.message || e);
      } catch (_) {}
      return "";
    }
  }
}
