// src/core/RecallEngine.js
// STAGE 8A — Recall Engine (safe, fail-open)

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

export class RecallEngine {
  constructor({ db, logger }) {
    this.db = db;
    this.logger = logger || console;
  }

  async buildRecallContext({ chatId, globalUserId = null, query = "", limit = 5 }) {
    try {
      const enabled = envTruthy(process.env.RECALL_ENABLED);
      if (!enabled) return "";

      const lim = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(20, Number(limit)))
        : 5;

      const chatIdStr = chatId != null ? String(chatId) : null;
      const globalStr = globalUserId != null ? String(globalUserId) : null;

      if (!chatIdStr) return "";

      // ✅ NEW — TimeContext real usage
      const timeCtx = createTimeContext({
        userTimezoneFromDb: null,
      });

      const parsed = timeCtx.parseHumanDate(query);
      const useRange = Boolean(parsed?.fromUTC && parsed?.toUTC);

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
            params.push(parsed.fromUTC);
            params.push(parsed.toUTC);
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
            params.push(parsed.fromUTC);
            params.push(parsed.toUTC);
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
                hint: parsed?.hint || null,
                from_utc: parsed?.fromUTC
                  ? new Date(parsed.fromUTC).toISOString()
                  : null,
                to_utc: parsed?.toUTC
                  ? new Date(parsed.toUTC).toISOString()
                  : null,
                tz_note: "filter=UTC (via TimeContext)",
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

        const prefix =
          role === "user"
            ? "U:"
            : role === "assistant"
            ? "A:"
            : `${role}:`;

        lines.push(`${prefix} ${text}`);

        if (lines.length >= lim * 2) break;
      }

      if (lines.length === 0) return "";

      const header = `Последние сообщения (контекст памяти):`;
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
}
