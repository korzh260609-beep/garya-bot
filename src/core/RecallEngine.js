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

      const lim = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(20, Number(limit))) : 5;

      const chatIdStr = chatId != null ? String(chatId) : null;
      const globalStr = globalUserId != null ? String(globalUserId) : null;

      if (!chatIdStr) return "";

      // 1) Primary scope: chat_id + global_user_id (if provided)
      let rows = [];
      let scope = "chat_only";

      if (globalStr) {
        try {
          const r1 = await this.db.query(
            `
            SELECT role, content, created_at
            FROM chat_memory
            WHERE chat_id = $1 AND global_user_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            `,
            [chatIdStr, globalStr, lim * 6] // take more to form turns
          );
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
          const r2 = await this.db.query(
            `
            SELECT role, content, created_at
            FROM chat_memory
            WHERE chat_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            `,
            [chatIdStr, lim * 6]
          );
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

      // Extra hint: if user asks "что мы обсуждали вчера" but no dated memory exists,
      // recall will still show last turns; the model can answer based on that context.
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
