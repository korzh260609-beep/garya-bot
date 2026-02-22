// src/core/MemoryDiagnosticsService.js
// STAGE 7 — MEMORY LAYER V1
// Goal: move chat_memory diagnostics SQL OUT of handlers/router.
// Rule: handlers must NOT query chat_memory directly.

import pool from "../../db.js";

export class MemoryDiagnosticsService {
  constructor({ db = null, logger = null } = {}) {
    this.db = db || pool;
    this.logger = logger || console;
  }

  async getChatMemoryV2Columns() {
    let v2Cols = {
      global_user_id: false,
      transport: false,
      metadata: false,
      schema_version: false,
    };

    try {
      const colRes = await this.db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_memory'
      `);

      const cols = new Set((colRes.rows || []).map((r) => r.column_name));
      v2Cols = {
        global_user_id: cols.has("global_user_id"),
        transport: cols.has("transport"),
        metadata: cols.has("metadata"),
        schema_version: cols.has("schema_version"),
      };
    } catch (e) {
      this.logger.error("❌ chat_memory columns check failed:", e);
    }

    return v2Cols;
  }

  async memoryDiag({ chatIdStr, globalUserId = null } = {}) {
    if (!chatIdStr) return "⚠️ memoryDiag: missing chatId";

    try {
      const sumRes = await this.db.query(
        `
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN global_user_id IS NULL THEN 1 ELSE 0 END)::int AS null_global
        FROM chat_memory
        WHERE chat_id = $1
        `,
        [chatIdStr]
      );

      const total = sumRes.rows?.[0]?.total ?? 0;
      const nullGlobal = sumRes.rows?.[0]?.null_global ?? 0;

      let totalByGlobal = null;
      if (globalUserId) {
        const gRes = await this.db.query(
          `
          SELECT COUNT(*)::int AS total
          FROM chat_memory
          WHERE global_user_id = $1
          `,
          [globalUserId]
        );
        totalByGlobal = gRes.rows?.[0]?.total ?? 0;
      }

      const lastRes = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          schema_version,
          created_at,
          LEFT(content, 80) AS content_preview
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT 8
        `,
        [chatIdStr]
      );

      const rows = lastRes.rows || [];

      const lines = [];
      lines.push("🧪 MEMORY DIAG");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push(`rows for chat_id: ${total}`);
      lines.push(`rows with global_user_id NULL: ${nullGlobal}`);
      if (globalUserId) lines.push(`rows for global_user_id: ${totalByGlobal}`);
      lines.push("");
      lines.push("Last rows:");
      for (const r of rows) {
        const ts = r.created_at ? new Date(r.created_at).toISOString() : "—";
        const preview = String(r.content_preview || "").replace(/\s+/g, " ").trim();
        lines.push(
          `#${r.id} | g=${r.global_user_id || "NULL"} | t=${r.transport || "—"} | role=${r.role || "—"} | sv=${r.schema_version ?? "—"} | ${ts} | "${preview}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryDiag error:", e);
      return "⚠️ /memory_diag упал. Смотри логи Render.";
    }
  }

  async memoryIntegrity({ chatIdStr } = {}) {
    if (!chatIdStr) return "⚠️ memoryIntegrity: missing chatId";

    try {
      const sumRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
        )
        SELECT
          COUNT(*)::int AS total_rows_with_mid,
          COUNT(DISTINCT mid)::int AS distinct_mid
        FROM msgs
        `,
        [chatIdStr]
      );

      const totalRowsWithMid = sumRes.rows?.[0]?.total_rows_with_mid ?? 0;
      const distinctMid = sumRes.rows?.[0]?.distinct_mid ?? 0;

      const dupRes = await this.db.query(
        `
        SELECT
          (metadata->>'messageId') AS mid,
          role,
          COUNT(*)::int AS cnt
        FROM chat_memory
        WHERE chat_id = $1
          AND metadata ? 'messageId'
          AND (metadata->>'messageId') ~ '^[0-9]+$'
        GROUP BY 1,2
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, mid DESC
        LIMIT 15
        `,
        [chatIdStr]
      );

      const anomRes = await this.db.query(
        `
        WITH g AS (
          SELECT
            (metadata->>'messageId') AS mid,
            SUM(CASE WHEN role='user' THEN 1 ELSE 0 END)::int AS u,
            SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END)::int AS a,
            COUNT(*)::int AS total
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
          GROUP BY 1
        )
        SELECT mid, u, a, total
        FROM g
        WHERE NOT (u=1 AND a=1 AND total=2)
        ORDER BY total DESC, mid DESC
        LIMIT 15
        `,
        [chatIdStr]
      );

      const mids = (anomRes.rows || []).map((r) => r.mid).filter(Boolean);
      let previewRows = [];
      if (mids.length > 0) {
        const prevRes = await this.db.query(
          `
          SELECT
            (metadata->>'messageId') AS mid,
            id,
            role,
            created_at,
            LEFT(content, 70) AS content_preview
          FROM chat_memory
          WHERE chat_id = $1
            AND (metadata->>'messageId') = ANY($2::text[])
          ORDER BY id DESC
          LIMIT 20
          `,
          [chatIdStr, mids]
        );
        previewRows = prevRes.rows || [];
      }

      const lines = [];
      lines.push("🧪 MEMORY INTEGRITY");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`rows_with_messageId: ${totalRowsWithMid}`);
      lines.push(`distinct_messageId: ${distinctMid}`);
      lines.push("");

      lines.push("1) Duplicates (same messageId + role, cnt>1):");
      if ((dupRes.rows || []).length === 0) {
        lines.push("OK: none ✅");
      } else {
        for (const r of dupRes.rows) {
          lines.push(`mid=${r.mid} | role=${r.role} | cnt=${r.cnt}`);
        }
      }
      lines.push("");

      lines.push("2) Pair anomalies (expected u=1 a=1 total=2):");
      if ((anomRes.rows || []).length === 0) {
        lines.push("OK: none ✅");
      } else {
        for (const r of anomRes.rows) {
          lines.push(`mid=${r.mid} | u=${r.u} | a=${r.a} | total=${r.total}`);
        }
      }

      if (previewRows.length > 0) {
        lines.push("");
        lines.push("Last anomaly rows (preview):");
        for (const r of previewRows) {
          const ts = r.created_at ? new Date(r.created_at).toISOString() : "—";
          const preview = String(r.content_preview || "").replace(/\s+/g, " ").trim();
          lines.push(`#${r.id} | mid=${r.mid} | role=${r.role} | ${ts} | "${preview}"`);
        }
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryIntegrity error:", e);
      return "⚠️ /memory_integrity упал. Смотри логи Render.";
    }
  }

  async memoryBackfill({ chatIdStr, globalUserId, limit = 200 } = {}) {
    if (!chatIdStr) return "⚠️ memoryBackfill: missing chatId";
    if (!globalUserId) return "⚠️ globalUserId=NULL. Нечего бэкфиллить.";

    const rawN = Number(limit);
    const safeLimit = Number.isFinite(rawN) ? Math.max(1, Math.min(500, rawN)) : 200;

    try {
      const updRes = await this.db.query(
        `
        WITH to_upd AS (
          SELECT id
          FROM chat_memory
          WHERE chat_id = $1
            AND global_user_id IS NULL
          ORDER BY id ASC
          LIMIT $3
        )
        UPDATE chat_memory cm
        SET global_user_id = $2
        WHERE cm.id IN (SELECT id FROM to_upd)
        RETURNING cm.id
        `,
        [chatIdStr, globalUserId, safeLimit]
      );

      const updated = updRes.rows?.length || 0;

      const remainRes = await this.db.query(
        `
        SELECT COUNT(*)::int AS remaining
        FROM chat_memory
        WHERE chat_id = $1
          AND global_user_id IS NULL
        `,
        [chatIdStr]
      );

      const remaining = remainRes.rows?.[0]?.remaining ?? 0;

      return [
        "🧠 MEMORY BACKFILL",
        `chat_id: ${chatIdStr}`,
        `globalUserId: ${globalUserId}`,
        `updated_now: ${updated}`,
        `remaining_null: ${remaining}`,
        "",
        "Run again if remaining_null > 0:",
        "/memory_backfill 500",
      ].join("\n");
    } catch (e) {
      this.logger.error("❌ memoryBackfill error:", e);
      return "⚠️ /memory_backfill упал. Смотри логи Render.";
    }
  }
}

export default MemoryDiagnosticsService;
