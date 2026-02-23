// src/core/RecallEngine.js
// STAGE 8A — RECALL ENGINE (MVP SKELETON, no embeddings)
// Goal: structure + interface + safe wiring points (does nothing when disabled)
//
// STAGE 8A.2 — Recall by date/period (Kyiv day boundaries via parseDatePeriod)
//
// PATCH (Stage 8): fallback to chat_memory when chat_messages returns 0 rows
// - NEVER blind-fallback by chat_id in groups (requires global_user_id)
// - fail-open: any error => empty recall

import { parseDatePeriod } from "./recall/datePeriodParser.js";

function safeTruncate(s, max = 600) {
  const t = typeof s === "string" ? s : "";
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

export default class RecallEngine {
  constructor(opts = {}) {
    this.db = opts.db || null;
    this.logger = opts.logger || console;
    this.config = opts.config || {};
  }

  status() {
    const enabled = String(process.env.RECALL_ENABLED || "").trim().toLowerCase() === "true";
    return {
      enabled,
      mode: "8A.2",
      hasDb: Boolean(this.db),
    };
  }

  /**
   * MVP recall (8A.2): if query contains date/period — fetch messages within window.
   * Primary source: chat_messages
   * Fallback: chat_memory (only when global_user_id exists; no blind group mixing)
   *
   * @returns {Promise<Array<{source:string, content:string, meta?:object}>>}
   */
  async recall({ chatId, globalUserId, query, limit = 5 } = {}) {
    const st = this.status();
    if (!st.enabled) return [];
    if (!this.db || typeof this.db.query !== "function") return [];

    const chatIdStr = chatId ? String(chatId) : null;
    if (!chatIdStr) return [];

    // 8A.1 — parse date/period intent (Kyiv boundaries inside parser)
    let period = null;
    try {
      period = parseDatePeriod(String(query || ""), new Date());
    } catch (e) {
      this.logger?.error?.("❌ parseDatePeriod failed (fail-open):", e);
      return [];
    }

    if (!period || period.type === "none" || !period.from || !period.to) {
      // No date intent yet → no recall (8A.2 scope)
      return [];
    }

    const hardLimit = Math.max(1, Math.min(Number(limit) || 5, 10)); // strict cap
    const from = period.from;
    const to = period.to;

    const useGlobal =
      globalUserId !== null &&
      globalUserId !== undefined &&
      String(globalUserId).trim() !== "";

    // =========================
    // 1) Primary: chat_messages
    // =========================
    try {
      const params = useGlobal
        ? [chatIdStr, String(globalUserId), from.toISOString(), to.toISOString(), hardLimit]
        : [chatIdStr, from.toISOString(), to.toISOString(), hardLimit];

      const sql = useGlobal
        ? `
          SELECT role, content, created_at
          FROM chat_messages
          WHERE chat_id = $1
            AND global_user_id = $2
            AND created_at >= $3::timestamptz
            AND created_at <= $4::timestamptz
          ORDER BY created_at DESC
          LIMIT $5
        `
        : `
          SELECT role, content, created_at
          FROM chat_messages
          WHERE chat_id = $1
            AND created_at >= $2::timestamptz
            AND created_at <= $3::timestamptz
          ORDER BY created_at DESC
          LIMIT $4
        `;

      const r = await this.db.query(sql, params);
      const rows = Array.isArray(r?.rows) ? r.rows : [];

      if (rows.length > 0) {
        return rows.map((x) => ({
          source: "chat_messages",
          content: safeTruncate(x?.content || "", 600),
          meta: {
            role: x?.role || null,
            created_at: x?.created_at || null,
            window: {
              type: period.type,
              from: from.toISOString(),
              to: to.toISOString(),
              tz: String(process.env.RECALL_TZ || "Europe/Kyiv"),
            },
            confidence: typeof period.confidence === "number" ? period.confidence : null,
          },
        }));
      }
    } catch (e) {
      this.logger?.error?.("❌ RecallEngine chat_messages query failed (fail-open):", e);
      // continue to fallback
    }

    // ==========================================
    // 2) Fallback: chat_memory (historical store)
    // ==========================================
    // IMPORTANT:
    // - In groups: NEVER do blind fallback by chat_id only.
    // - So if no globalUserId -> return [] (fail-open).
    if (!useGlobal) return [];

    try {
      const params2 = [chatIdStr, String(globalUserId), from.toISOString(), to.toISOString(), hardLimit];

      // chat_memory schema (v2) is assumed: chat_id, global_user_id, role, content, created_at
      const sql2 = `
        SELECT role, content, created_at
        FROM chat_memory
        WHERE chat_id = $1
          AND global_user_id = $2
          AND created_at >= $3::timestamptz
          AND created_at <= $4::timestamptz
        ORDER BY created_at DESC
        LIMIT $5
      `;

      const r2 = await this.db.query(sql2, params2);
      const rows2 = Array.isArray(r2?.rows) ? r2.rows : [];

      return rows2.map((x) => ({
        source: "chat_memory",
        content: safeTruncate(x?.content || "", 600),
        meta: {
          role: x?.role || null,
          created_at: x?.created_at || null,
          window: {
            type: period.type,
            from: from.toISOString(),
            to: to.toISOString(),
            tz: String(process.env.RECALL_TZ || "Europe/Kyiv"),
          },
          confidence: typeof period.confidence === "number" ? period.confidence : null,
        },
      }));
    } catch (e) {
      this.logger?.error?.("❌ RecallEngine chat_memory fallback failed (fail-open):", e);
      return [];
    }
  }

  /**
   * Build a single string block to inject into system messages.
   * In 8A.2 returns a compact list.
   */
  async buildRecallContext({ chatId, globalUserId, query, limit = 5 } = {}) {
    const items = await this.recall({ chatId, globalUserId, query, limit });
    if (!items || items.length === 0) return "";
    // Future: formatting rules here (not in 8A)
    return items.map((x) => `- [${x.source}] ${x.content}`).join("\n");
  }
}
