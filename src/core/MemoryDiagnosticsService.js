// src/core/MemoryDiagnosticsService.js
// STAGE 7 — MEMORY LAYER V1
// Goal: move chat_memory diagnostics SQL OUT of handlers/router.
// Rule: handlers must NOT query chat_memory directly.

import pool from "../../db.js";
import MemoryService from "./MemoryService.js";

export class MemoryDiagnosticsService {
  constructor({ db = null, logger = null } = {}) {
    this.db = db || pool;
    this.logger = logger || console;
    this.memoryService = new MemoryService({ db: this.db, logger: this.logger });
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
          (metadata->>'messageId') AS mid,
          LEFT(content, 80) AS content_preview
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT 12
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
          `#${r.id} | mid=${r.mid || "—"} | g=${r.global_user_id || "NULL"} | t=${
            r.transport || "—"
          } | role=${r.role || "—"} | sv=${r.schema_version ?? "—"} | ${ts} | "${preview}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryDiag error:", e);
      return "⚠️ /memory_diag упал. Смотри логи Render.";
    }
  }

  async memoryLongTermDiag({ chatIdStr, globalUserId = null } = {}) {
    if (!chatIdStr) return "⚠️ memoryLongTermDiag: missing chatId";

    try {
      const sumRes = await this.db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        `,
        [chatIdStr]
      );

      const total = sumRes.rows?.[0]?.total ?? 0;

      let totalByGlobal = null;
      if (globalUserId) {
        const gRes = await this.db.query(
          `
          SELECT COUNT(*)::int AS total
          FROM chat_memory
          WHERE chat_id = $1
            AND global_user_id = $2
            AND role = 'system'
            AND metadata->>'memoryType' = 'long_term'
          `,
          [chatIdStr, globalUserId]
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
          metadata->>'rememberKey' AS remember_key,
          metadata->>'rememberType' AS remember_type,
          metadata->>'source' AS source,
          metadata->>'explicit' AS explicit,
          LEFT(content, 140) AS content_preview
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        ORDER BY id DESC
        LIMIT 20
        `,
        [chatIdStr]
      );

      const rows = lastRes.rows || [];

      const lines = [];
      lines.push("🧠 MEMORY LONG-TERM DIAG");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push(`long_term rows for chat_id: ${total}`);
      if (globalUserId) lines.push(`long_term rows for global_user_id in this chat: ${totalByGlobal}`);
      lines.push("");

      if (rows.length === 0) {
        lines.push("No long-term rows found.");
        return lines.join("\n");
      }

      lines.push("Last long-term rows:");
      for (const r of rows) {
        const ts = r.created_at ? new Date(r.created_at).toISOString() : "—";
        const preview = String(r.content_preview || "").replace(/\s+/g, " ").trim();
        lines.push(
          `#${r.id} | g=${r.global_user_id || "NULL"} | t=${r.transport || "—"} | role=${r.role || "—"} | sv=${r.schema_version ?? "—"} | type=${r.remember_type || "—"} | key=${r.remember_key || "—"} | explicit=${r.explicit || "—"} | source=${r.source || "—"} | ${ts} | "${preview}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryLongTermDiag error:", e);
      return "⚠️ /memory_longterm_diag упал. Смотри логи Render.";
    }
  }

  async memoryTypeStats({ chatIdStr, globalUserId = null } = {}) {
    if (!chatIdStr) return "⚠️ memoryTypeStats: missing chatId";

    try {
      const params = [chatIdStr];
      let idx = 2;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(globalUserId);
        idx += 1;
      }

      const res = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberType', ''), '—') AS remember_type,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1
        ORDER BY total DESC, remember_type ASC
        `,
        params
      );

      const keyRes = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberKey', ''), '—') AS remember_key,
          COALESCE(NULLIF(metadata->>'rememberType', ''), '—') AS remember_type,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1,2
        ORDER BY total DESC, remember_type ASC, remember_key ASC
        LIMIT 20
        `,
        params
      );

      const rows = res.rows || [];
      const keyRows = keyRes.rows || [];

      const lines = [];
      lines.push("🧠 MEMORY TYPE STATS");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push("");

      if (rows.length === 0) {
        lines.push("No long-term rows found.");
        return lines.join("\n");
      }

      lines.push("By type:");
      for (const r of rows) {
        lines.push(`type=${r.remember_type} | total=${r.total}`);
      }

      lines.push("");
      lines.push("Top key/type pairs:");
      for (const r of keyRows) {
        lines.push(`type=${r.remember_type} | key=${r.remember_key} | total=${r.total}`);
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryTypeStats error:", e);
      return "⚠️ /memory_type_stats упал. Смотри логи Render.";
    }
  }

  async memoryFetchByType({ chatIdStr, globalUserId = null, rememberType = null, limit = 10 } = {}) {
    const rememberTypeStr = String(rememberType || "").trim();

    if (!chatIdStr) return "⚠️ memoryFetchByType: missing chatId";
    if (!rememberTypeStr) return "⚠️ usage: /memory_fetch_type <rememberType> [limit]";

    try {
      const result = await this.memoryService.getLongTermByType({
        chatId: chatIdStr,
        globalUserId,
        rememberType: rememberTypeStr,
        limit,
      });

      if (!result || result.ok !== true) {
        return `⚠️ memory fetch by type failed: ${result?.reason || "unknown_error"}`;
      }

      const lines = [];
      lines.push("🧠 MEMORY FETCH BY TYPE");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push(`type: ${rememberTypeStr}`);
      lines.push(`total: ${result.total ?? 0}`);
      lines.push("");

      if (!Array.isArray(result.items) || result.items.length === 0) {
        lines.push("No rows found.");
        return lines.join("\n");
      }

      lines.push("Rows:");
      for (const item of result.items.slice(0, 20)) {
        const ts = item?.createdAt || "—";
        const value = String(item?.value || "").replace(/\s+/g, " ").trim().slice(0, 160);
        lines.push(
          `#${item?.id ?? "—"} | key=${item?.rememberKey || "—"} | type=${item?.rememberType || "—"} | explicit=${item?.explicit ? "true" : "false"} | ${ts} | "${value}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryFetchByType error:", e);
      return "⚠️ /memory_fetch_type упал. Смотри логи Render.";
    }
  }

  async memoryFetchByKey({ chatIdStr, globalUserId = null, rememberKey = null, limit = 10 } = {}) {
    const rememberKeyStr = String(rememberKey || "").trim();

    if (!chatIdStr) return "⚠️ memoryFetchByKey: missing chatId";
    if (!rememberKeyStr) return "⚠️ usage: /memory_fetch_key <rememberKey> [limit]";

    try {
      const result = await this.memoryService.getLongTermByKey({
        chatId: chatIdStr,
        globalUserId,
        rememberKey: rememberKeyStr,
        limit,
      });

      if (!result || result.ok !== true) {
        return `⚠️ memory fetch by key failed: ${result?.reason || "unknown_error"}`;
      }

      const lines = [];
      lines.push("🧠 MEMORY FETCH BY KEY");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push(`key: ${rememberKeyStr}`);
      lines.push(`total: ${result.total ?? 0}`);
      lines.push("");

      if (!Array.isArray(result.items) || result.items.length === 0) {
        lines.push("No rows found.");
        return lines.join("\n");
      }

      lines.push("Rows:");
      for (const item of result.items.slice(0, 20)) {
        const ts = item?.createdAt || "—";
        const value = String(item?.value || "").replace(/\s+/g, " ").trim().slice(0, 160);
        lines.push(
          `#${item?.id ?? "—"} | key=${item?.rememberKey || "—"} | type=${item?.rememberType || "—"} | explicit=${item?.explicit ? "true" : "false"} | ${ts} | "${value}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryFetchByKey error:", e);
      return "⚠️ /memory_fetch_key упал. Смотри логи Render.";
    }
  }

  async memorySummaryViaService({ chatIdStr, globalUserId = null, limit = 20 } = {}) {
    if (!chatIdStr) return "⚠️ memorySummaryViaService: missing chatId";

    try {
      const result = await this.memoryService.getLongTermSummary({
        chatId: chatIdStr,
        globalUserId,
        limit,
      });

      if (!result || result.ok !== true) {
        return `⚠️ memory summary via service failed: ${result?.reason || "unknown_error"}`;
      }

      const byType = Array.isArray(result.byType) ? result.byType : [];
      const byKeyType = Array.isArray(result.byKeyType) ? result.byKeyType : [];

      const lines = [];
      lines.push("🧠 MEMORY SUMMARY VIA SERVICE");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push("");

      if (byType.length === 0) {
        lines.push("No long-term rows found.");
        return lines.join("\n");
      }

      lines.push("By type:");
      for (const row of byType) {
        lines.push(`type=${row.remember_type} | total=${row.total}`);
      }

      lines.push("");
      lines.push("Top key/type pairs:");
      for (const row of byKeyType) {
        lines.push(`type=${row.remember_type} | key=${row.remember_key} | total=${row.total}`);
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memorySummaryViaService error:", e);
      return "⚠️ /memory_summary_service упал. Смотри логи Render.";
    }
  }

  async memorySelectContext({
    chatIdStr,
    globalUserId = null,
    rememberTypes = [],
    rememberKeys = [],
    perTypeLimit = 3,
    perKeyLimit = 3,
    totalLimit = 12,
  } = {}) {
    if (!chatIdStr) return "⚠️ memorySelectContext: missing chatId";

    try {
      const result = await this.memoryService.selectLongTermContext({
        chatId: chatIdStr,
        globalUserId,
        rememberTypes,
        rememberKeys,
        perTypeLimit,
        perKeyLimit,
        totalLimit,
      });

      if (!result || result.ok !== true) {
        return `⚠️ memory select context failed: ${result?.reason || "unknown_error"}`;
      }

      const lines = [];
      lines.push("🧠 MEMORY SELECT CONTEXT");
      lines.push(`chat_id: ${chatIdStr}`);
      lines.push(`globalUserId (resolved): ${globalUserId || "NULL"}`);
      lines.push(`types: ${Array.isArray(result.rememberTypes) && result.rememberTypes.length > 0 ? result.rememberTypes.join(", ") : "—"}`);
      lines.push(`keys: ${Array.isArray(result.rememberKeys) && result.rememberKeys.length > 0 ? result.rememberKeys.join(", ") : "—"}`);
      lines.push(`total: ${result.total ?? 0}`);

      if (result?.limits) {
        lines.push(
          `limits: perType=${result.limits.perTypeLimit} | perKey=${result.limits.perKeyLimit} | total=${result.limits.totalLimit}`
        );
      }

      lines.push("");

      if (!Array.isArray(result.items) || result.items.length === 0) {
        lines.push("No rows found.");
        return lines.join("\n");
      }

      lines.push("Rows:");
      for (const item of result.items.slice(0, 20)) {
        const ts = item?.createdAt || "—";
        const value = String(item?.value || "").replace(/\s+/g, " ").trim().slice(0, 160);
        lines.push(
          `#${item?.id ?? "—"} | key=${item?.rememberKey || "—"} | type=${item?.rememberType || "—"} | explicit=${item?.explicit ? "true" : "false"} | ${ts} | "${value}"`
        );
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memorySelectContext error:", e);
      return "⚠️ /memory_select_context упал. Смотри логи Render.";
    }
  }

  /**
   * Integrity check for *chat pairs*.
   * IMPORTANT: we EXCLUDE commands (user content starting with '/') because
   * command replies are not guaranteed to be stored as assistant rows with the same messageId.
   */
  async memoryIntegrity({ chatIdStr } = {}) {
    if (!chatIdStr) return "⚠️ memoryIntegrity: missing chatId";

    try {
      const sumRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
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
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
        )
        SELECT mid, role, COUNT(*)::int AS cnt
        FROM msgs
        GROUP BY 1,2
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, mid DESC
        LIMIT 15
        `,
        [chatIdStr]
      );

      const anomRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
        ),
        g AS (
          SELECT
            mid,
            SUM(CASE WHEN role='user' THEN 1 ELSE 0 END)::int AS u,
            SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END)::int AS a,
            COUNT(*)::int AS total
          FROM msgs
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

      const anomCountRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
        ),
        g AS (
          SELECT
            mid,
            SUM(CASE WHEN role='user' THEN 1 ELSE 0 END)::int AS u,
            SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END)::int AS a,
            COUNT(*)::int AS total
          FROM msgs
          GROUP BY 1
        )
        SELECT
          SUM(CASE WHEN u=1 AND a=0 THEN 1 ELSE 0 END)::int AS missing_assistant,
          SUM(CASE WHEN u=0 AND a=1 THEN 1 ELSE 0 END)::int AS missing_user,
          SUM(CASE WHEN u>1 AND a=1 THEN 1 ELSE 0 END)::int AS multi_user,
          SUM(CASE WHEN u=1 AND a>1 THEN 1 ELSE 0 END)::int AS multi_assistant,
          SUM(CASE WHEN NOT (u=1 AND a=1 AND total=2) THEN 1 ELSE 0 END)::int AS total_anom
        FROM g
        `,
        [chatIdStr]
      );

      const assistantDupRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND role = 'assistant'
        )
        SELECT mid, COUNT(*)::int AS cnt
        FROM msgs
        GROUP BY 1
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC, mid DESC
        LIMIT 15
        `,
        [chatIdStr]
      );

      const mids = (anomRes.rows || []).map((r) => r.mid).filter(Boolean);
      let previewRows = [];
      if (mids.length > 0) {
        const prevRes = await this.db.query(
          `
          WITH msgs AS (
            SELECT
              (metadata->>'messageId') AS mid,
              id,
              role,
              created_at,
              content
            FROM chat_memory
            WHERE chat_id = $1
              AND (metadata->>'messageId') = ANY($2::text[])
              AND metadata ? 'messageId'
              AND (metadata->>'messageId') ~ '^[0-9]+$'
              AND NOT (role='user' AND content LIKE '/%')
          )
          SELECT
            mid,
            id,
            role,
            created_at,
            LEFT(content, 70) AS content_preview
          FROM msgs
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
      lines.push("NOTE: commands '/...' are excluded from pairing check ✅");
      lines.push("");

      const anomCounts = anomCountRes.rows?.[0] || {};
      lines.push("0) Summary (by messageId):");
      lines.push(`total_anom: ${anomCounts.total_anom ?? 0}`);
      lines.push(`missing_assistant (u=1 a=0): ${anomCounts.missing_assistant ?? 0}`);
      lines.push(`missing_user      (u=0 a=1): ${anomCounts.missing_user ?? 0}`);
      lines.push(`multi_user        (u>1): ${anomCounts.multi_user ?? 0}`);
      lines.push(`multi_assistant   (a>1): ${anomCounts.multi_assistant ?? 0}`);
      lines.push("");

      lines.push("1) Assistant duplicates (same messageId, role=assistant, cnt>1):");
      if ((assistantDupRes.rows || []).length === 0) {
        lines.push("OK: none ✅");
      } else {
        for (const r of assistantDupRes.rows) {
          lines.push(`mid=${r.mid} | role=assistant | cnt=${r.cnt}`);
        }
      }
      lines.push("");

      lines.push("2) Duplicates (same messageId + role, cnt>1):");
      if ((dupRes.rows || []).length === 0) {
        lines.push("OK: none ✅");
      } else {
        for (const r of dupRes.rows) {
          lines.push(`mid=${r.mid} | role=${r.role} | cnt=${r.cnt}`);
        }
      }
      lines.push("");

      lines.push("3) Pair anomalies (expected u=1 a=1 total=2):");
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

  async memoryUserChats({ globalUserId } = {}) {
    if (!globalUserId) return "⚠️ /memory_user_chats: globalUserId is NULL";

    try {
      const res = await this.db.query(
        `
        SELECT
          chat_id,
          COUNT(*)::int AS rows,
          MIN(created_at) AS first_ts,
          MAX(created_at) AS last_ts
        FROM chat_memory
        WHERE global_user_id = $1
        GROUP BY chat_id
        ORDER BY rows DESC, chat_id ASC
        LIMIT 30
        `,
        [globalUserId]
      );

      const rows = res.rows || [];
      const lines = [];
      lines.push("🧪 MEMORY USER CHATS");
      lines.push(`globalUserId: ${globalUserId}`);
      lines.push(`distinct chat_id: ${rows.length}`);
      lines.push("");
      lines.push("Top chats (by rows):");
      for (const r of rows) {
        const first = r.first_ts ? new Date(r.first_ts).toISOString() : "—";
        const last = r.last_ts ? new Date(r.last_ts).toISOString() : "—";
        lines.push(`chat_id=${r.chat_id} | rows=${r.rows} | first=${first} | last=${last}`);
      }

      if (rows.length === 30) {
        lines.push("");
        lines.push("⚠️ limit=30 reached (may be more chat_id).");
      }

      return lines.join("\n").slice(0, 3800);
    } catch (e) {
      this.logger.error("❌ memoryUserChats error:", e);
      return "⚠️ /memory_user_chats упал. Смотри логи Render.";
    }
  }

  async robotMockMonitor({ chatIdStr, globalUserId = null } = {}) {
    if (!chatIdStr) return "⚠️ robotMockMonitor: missing chatId";

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

      const dupRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
        )
        SELECT COUNT(*)::int AS dup_groups
        FROM (
          SELECT mid, role, COUNT(*)::int AS cnt
          FROM msgs
          GROUP BY 1,2
          HAVING COUNT(*) > 1
        ) x
        `,
        [chatIdStr]
      );

      const dupGroups = dupRes.rows?.[0]?.dup_groups ?? 0;

      const anomRes = await this.db.query(
        `
        WITH msgs AS (
          SELECT
            (metadata->>'messageId') AS mid,
            role,
            content
          FROM chat_memory
          WHERE chat_id = $1
            AND metadata ? 'messageId'
            AND (metadata->>'messageId') ~ '^[0-9]+$'
            AND NOT (role='user' AND content LIKE '/%')
        ),
        g AS (
          SELECT
            mid,
            SUM(CASE WHEN role='user' THEN 1 ELSE 0 END)::int AS u,
            SUM(CASE WHEN role='assistant' THEN 1 ELSE 0 END)::int AS a,
            COUNT(*)::int AS total
          FROM msgs
          GROUP BY 1
        )
        SELECT COUNT(*)::int AS anom_mids
        FROM g
        WHERE NOT (u=1 AND a=1 AND total=2)
        `,
        [chatIdStr]
      );

      const anomMids = anomRes.rows?.[0]?.anom_mids ?? 0;

      const ok = dupGroups === 0 && anomMids === 0;

      return [
        "🤖 MEMORY ROBOT (mock-monitor)",
        `chat_id: ${chatIdStr}`,
        `globalUserId: ${globalUserId || "NULL"}`,
        `rows_total: ${total}`,
        `null_global_user_id: ${nullGlobal}`,
        `dup_groups(mid+role): ${dupGroups}`,
        `anom_mids(pairing): ${anomMids}`,
        `ok: ${ok ? "YES ✅" : "NO ⛔"}`,
      ].join("\n");
    } catch (e) {
      this.logger.error("❌ robotMockMonitor error:", e);
      return "⚠️ robotMockMonitor упал. Смотри логи Render.";
    }
  }
}

export default MemoryDiagnosticsService;