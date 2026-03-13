// src/core/RecallEngine.js
// STAGE 8A — Recall Engine (safe, fail-open)
//
// Goal (Stage 8):
// - buildRecallContext(): prefer LONG-TERM chat history (chat_messages, Stage 7B)
// - fallback to chat_memory (Stage 7) if anything fails
// - keep fail-open: bot must keep replying even if recall breaks

import { createTimeContext } from "./time/timeContextFactory.js";

function envTruthy(v) {
  if (v === true) return true;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function envInt(name, def, min = null, max = null) {
  const raw = process.env[name];
  const n = Number.isFinite(Number(raw)) ? Math.trunc(Number(raw)) : def;
  let v = n;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
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

export class RecallEngine {
  constructor({ db, logger }) {
    this.db = db;
    this.logger = logger || console;
  }

  async buildRecallContext({
    chatId,
    globalUserId = null,
    query = "",
    limit = 5,
    userTimezone = null,
  }) {
    try {
      const enabled = envTruthy(process.env.RECALL_ENABLED);
      if (!enabled) return "";

      const lim = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(20, Number(limit)))
        : 5;

      const chatIdStr = chatId != null ? String(chatId) : null;
      const globalStr = globalUserId != null ? String(globalUserId) : null;
      if (!chatIdStr) return "";

      // ✅ TimeContext should use USER TZ when parsing human date ranges
      const timeCtx = createTimeContext({
        userTimezoneFromDb: userTimezone || null,
      });

      const q = String(query || "");
      const parsed = timeCtx.parseHumanDate(q);
      const useRange = Boolean(parsed?.fromUTC && parsed?.toUTC);

      // ✅ Optional clamp to avoid huge scans (Stage 8 safety)
      // Default: 30 days. Can be changed via env RECALL_MAX_DAYS.
      const maxDays = envInt("RECALL_MAX_DAYS", 30, 1, 365);

      let fromUTC = parsed?.fromUTC || null;
      let toUTC = parsed?.toUTC || null;

      if (useRange) {
        try {
          const now = Date.now();
          const minFrom = now - maxDays * 24 * 60 * 60 * 1000;
          const f = new Date(fromUTC).getTime();
          const t = new Date(toUTC).getTime();

          // if parsing produced weird values, skip clamp
          if (Number.isFinite(f) && Number.isFinite(t)) {
            if (f < minFrom) fromUTC = new Date(minFrom).toISOString();
            // keep toUTC as parsed (usually "now/end of day"), but ensure it's not before from
            if (new Date(toUTC).getTime() < new Date(fromUTC).getTime()) {
              toUTC = new Date(now).toISOString();
            }
          }
        } catch (_) {
          // ignore clamp errors (fail-open)
        }
      }

      let rows = [];
      let scope = "chat_only";
      let source = "chat_messages";

      // ====================================================================
      // 1) Prefer chat_messages (Stage 7B long-term log)
      // ====================================================================
      const tryChatMessages = async () => {
        const params = [chatIdStr];
        let sql = `
          SELECT role, content, created_at
          FROM chat_messages
          WHERE chat_id = $1
            AND is_redacted = false
        `;

        // If we have global_user_id, narrow down first (better precision for private chats)
        if (globalStr) {
          params.push(globalStr);
          sql += ` AND (global_user_id = $2 OR role = 'assistant')`;
          scope = "chat+global";
        } else {
          scope = "chat_only";
        }

        if (useRange) {
          params.push(fromUTC);
          params.push(toUTC);
          const a = params.length - 1;
          const b = params.length;
          sql += ` AND created_at >= $${a} AND created_at < $${b}`;
        }

        // Keep it safe: we only need user/assistant for model context and guard logic
        sql += `
          AND role IN ('user','assistant')
          ORDER BY created_at DESC
        `;

        params.push(lim * 6);
        sql += ` LIMIT $${params.length}`;

        const r = await this.db.query(sql, params);
        return r?.rows || [];
      };

      try {
        rows = await tryChatMessages();
      } catch (e) {
        // fail-open: fallback to chat_memory
        try {
          this.logger.error(
            "❌ RecallEngine chat_messages query failed (fallback to chat_memory):",
            e?.message || e
          );
        } catch (_) {}
        rows = [];
        source = "chat_memory";
      }

      // ====================================================================
      // 2) Fallback: chat_memory (Stage 7 memory layer)
      // ====================================================================
      if (!rows || rows.length === 0) {
        try {
          if (globalStr) {
            const params = [chatIdStr, globalStr];
            let sql = `
              SELECT role, content, created_at
              FROM chat_memory
              WHERE chat_id = $1 AND global_user_id = $2
            `;

            if (useRange) {
              params.push(fromUTC);
              params.push(toUTC);
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
          }

          if (!rows || rows.length === 0) {
            const params = [chatIdStr];
            let sql = `
              SELECT role, content, created_at
              FROM chat_memory
              WHERE chat_id = $1
            `;

            if (useRange) {
              params.push(fromUTC);
              params.push(toUTC);
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
          }
        } catch (e) {
          try {
            this.logger.error(
              "❌ RecallEngine chat_memory query failed:",
              e?.message || e
            );
          } catch (_) {}
          return "";
        }
      }

      // ====================================================================
      // Logging (diagnostics)
      // ====================================================================
      try {
        this.logger.log("🧠 RECALL_ENGINE_ROWS", {
          source,
          scope,
          chatId: chatIdStr,
          globalUserId: globalStr,
          rows: Array.isArray(rows) ? rows.length : 0,
          q: q.slice(0, 80),
          dateFilter: useRange
            ? {
                hint: parsed?.hint || null,
                from_utc: fromUTC ? new Date(fromUTC).toISOString() : null,
                to_utc: toUTC ? new Date(toUTC).toISOString() : null,
                tz_used: userTimezone || null,
                max_days: maxDays,
              }
            : null,
        });
      } catch (_) {}

      if (!rows || rows.length === 0) return "";

      const asc = [...rows].reverse();

      const fmtTs = (dt, tz) => {
        try {
          const d = dt instanceof Date ? dt : new Date(dt);
          if (!d || isNaN(d.getTime())) return "";

          // sv-SE yields "YYYY-MM-DD HH:mm"
          return new Intl.DateTimeFormat("sv-SE", {
            timeZone: tz || "UTC",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(d);
        } catch (_) {
          try {
            const d = dt instanceof Date ? dt : new Date(dt);
            return d.toISOString();
          } catch (_) {
            return "";
          }
        }
      };

      const lines = [];
      for (const r of asc) {
        const role = normalizeRole(r.role);

        // ✅ IMPORTANT: only user/assistant lines count for chat.js guard
        if (role !== "user" && role !== "assistant") continue;

        const text = safeTrim(r.content, 500);
        if (!text) continue;

        const prefix = role === "user" ? "U:" : "A:";
        const ts = r?.created_at ? fmtTs(r.created_at, userTimezone || "UTC") : "";
        const tsLabel = ts ? `[${ts}] ` : "";
        lines.push(`${tsLabel}${prefix} ${text}`);

        if (lines.length >= lim * 2) break;
      }

      if (lines.length === 0) return "";

      const header =
        source === "chat_messages"
          ? `Последние сообщения (контекст истории):`
          : `Последние сообщения (контекст памяти):`;

      return [header, ...lines].join("\n");
    } catch (e) {
      try {
        this.logger.error(
          "❌ RecallEngine buildRecallContext failed:",
          e?.message || e
        );
      } catch (_) {}
      return "";
    }
  }

  // ========================================================================
  // search() — legacy/simple search
  // Возвращает: [{ id, role, content, created_at }] | []
  // ========================================================================
  async search({ chatId, days = 1, limit = 5, keyword = "" }) {
    const chatIdStr = chatId != null ? String(chatId) : null;
    if (!chatIdStr) return [];

    const lim = Math.max(
      1,
      Math.min(20, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 5)
    );

    const hardMax = envInt("RECALL_MAX_DAYS", 30, 1, 365);
    const d = Math.max(
      1,
      Math.min(hardMax, Number.isFinite(Number(days)) ? Math.trunc(Number(days)) : 1)
    );

    const kw = String(keyword ?? "").trim();

    try {
      const r = await this.db.query(
        `
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE chat_id = $1
          AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          AND ($3 = '' OR content ILIKE ('%' || $3 || '%'))
          AND is_redacted = false
          AND role IN ('user','assistant')
        ORDER BY created_at DESC, id DESC
        LIMIT $4
        `,
        [chatIdStr, d, kw, lim]
      );
      return r?.rows || [];
    } catch (e) {
      try {
        this.logger.error("❌ RecallEngine.search failed:", e?.message || e);
      } catch (_) {}
      return [];
    }
  }

  // ========================================================================
  // searchPage() — real stateless paging foundation for /recall_more
  // Параметры:
  //   chatId
  //   days
  //   limit
  //   keyword
  //   cursorCreatedAt (optional)
  //   cursorId (optional)
  //
  // Возвращает:
  //   {
  //     rows: [{ id, role, content, created_at }],
  //     hasMore: boolean
  //   }
  // ========================================================================
  async searchPage({
    chatId,
    days = 1,
    limit = 5,
    keyword = "",
    cursorCreatedAt = null,
    cursorId = null,
  }) {
    const chatIdStr = chatId != null ? String(chatId) : null;
    if (!chatIdStr) {
      return { rows: [], hasMore: false };
    }

    const lim = Math.max(
      1,
      Math.min(20, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 5)
    );

    const hardMax = envInt("RECALL_MAX_DAYS", 30, 1, 365);
    const d = Math.max(
      1,
      Math.min(hardMax, Number.isFinite(Number(days)) ? Math.trunc(Number(days)) : 1)
    );

    const kw = String(keyword ?? "").trim();

    const hasCursorTs =
      typeof cursorCreatedAt === "string" && cursorCreatedAt.trim().length > 0;
    const parsedCursorId = Number.isFinite(Number(cursorId))
      ? Math.trunc(Number(cursorId))
      : null;

    try {
      const params = [chatIdStr, d, kw];
      let sql = `
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE chat_id = $1
          AND created_at >= NOW() - ($2::int * INTERVAL '1 day')
          AND ($3 = '' OR content ILIKE ('%' || $3 || '%'))
          AND is_redacted = false
          AND role IN ('user','assistant')
      `;

      if (hasCursorTs && parsedCursorId !== null) {
        params.push(String(cursorCreatedAt).trim());
        params.push(parsedCursorId);

        const tsIdx = params.length - 1;
        const idIdx = params.length;

        sql += `
          AND (
            created_at < $${tsIdx}
            OR (created_at = $${tsIdx} AND id < $${idIdx})
          )
        `;
      }

      params.push(lim + 1);

      sql += `
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}
      `;

      const r = await this.db.query(sql, params);
      const rawRows = Array.isArray(r?.rows) ? r.rows : [];

      const hasMore = rawRows.length > lim;
      const rows = hasMore ? rawRows.slice(0, lim) : rawRows;

      return { rows, hasMore };
    } catch (e) {
      try {
        this.logger.error("❌ RecallEngine.searchPage failed:", e?.message || e);
      } catch (_) {}
      return { rows: [], hasMore: false };
    }
  }
}