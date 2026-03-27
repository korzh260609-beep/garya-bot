// ============================================================================
// src/logging/RenderLogInbox.js
// STAGE SKELETON — persistent latest render log snapshot inbox
// Purpose:
// - keep only latest log snapshot per chat/user scope
// - allow /render_diag_last after restart/redeploy
// - use PostgreSQL instead of in-memory Map
// IMPORTANT:
// - one latest snapshot per scope_key
// - lazy schema init (no db.js changes in this micro-step)
// - this is persistent bridge storage, not final full logs archive
// ============================================================================

import pool from "../../db.js";

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeText(value) {
  return safeStr(value).trim();
}

function buildScopeKey({ chatId, senderIdStr }) {
  const chat = normalizeText(chatId);
  const user = normalizeText(senderIdStr);
  return `${chat}::${user}`;
}

class RenderLogInbox {
  constructor({ dbPool } = {}) {
    this.pool = dbPool || pool;
    this.schemaReadyPromise = null;
  }

  async ensureSchema() {
    if (this.schemaReadyPromise) {
      return this.schemaReadyPromise;
    }

    this.schemaReadyPromise = (async () => {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS render_log_snapshots (
          scope_key TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          sender_id_str TEXT NOT NULL,
          log_text TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'telegram_manual',
          chars INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_render_log_snapshots_updated_at
        ON render_log_snapshots (updated_at DESC);
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_render_log_snapshots_chat_user
        ON render_log_snapshots (chat_id, sender_id_str);
      `);
    })();

    try {
      await this.schemaReadyPromise;
    } catch (error) {
      this.schemaReadyPromise = null;
      throw error;
    }

    return this.schemaReadyPromise;
  }

  async setLatest({ chatId, senderIdStr, logText, source = "telegram_manual" }) {
    await this.ensureSchema();

    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    const normalizedLog = normalizeText(logText);
    const normalizedChatId = normalizeText(chatId);
    const normalizedSenderIdStr = normalizeText(senderIdStr);
    const normalizedSource = normalizeText(source) || "telegram_manual";

    if (!scopeKey || !normalizedLog) {
      return { ok: false, reason: "missing_scope_or_log" };
    }

    const chars = normalizedLog.length;

    try {
      const res = await this.pool.query(
        `
        INSERT INTO render_log_snapshots (
          scope_key,
          chat_id,
          sender_id_str,
          log_text,
          source,
          chars,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (scope_key)
        DO UPDATE SET
          chat_id = EXCLUDED.chat_id,
          sender_id_str = EXCLUDED.sender_id_str,
          log_text = EXCLUDED.log_text,
          source = EXCLUDED.source,
          chars = EXCLUDED.chars,
          updated_at = NOW()
        RETURNING
          scope_key,
          chat_id,
          sender_id_str,
          log_text,
          source,
          chars,
          created_at,
          updated_at
        `,
        [
          scopeKey,
          normalizedChatId,
          normalizedSenderIdStr,
          normalizedLog,
          normalizedSource,
          chars,
        ]
      );

      const row = res?.rows?.[0];
      if (!row) {
        return { ok: false, reason: "db_no_row" };
      }

      return {
        ok: true,
        entry: {
          scopeKey: row.scope_key,
          chatId: row.chat_id,
          senderIdStr: row.sender_id_str,
          logText: row.log_text,
          source: row.source,
          chars: row.chars,
          createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
          updatedAt: row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : String(row.updated_at),
        },
      };
    } catch (error) {
      console.error("❌ RenderLogInbox.setLatest failed:", error);
      return { ok: false, reason: "db_error" };
    }
  }

  async getLatest({ chatId, senderIdStr }) {
    await this.ensureSchema();

    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    if (!scopeKey) return null;

    try {
      const res = await this.pool.query(
        `
        SELECT
          scope_key,
          chat_id,
          sender_id_str,
          log_text,
          source,
          chars,
          created_at,
          updated_at
        FROM render_log_snapshots
        WHERE scope_key = $1
        LIMIT 1
        `,
        [scopeKey]
      );

      const row = res?.rows?.[0];
      if (!row) return null;

      return {
        scopeKey: row.scope_key,
        chatId: row.chat_id,
        senderIdStr: row.sender_id_str,
        logText: row.log_text,
        source: row.source,
        chars: row.chars,
        createdAt: row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
        updatedAt: row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
      };
    } catch (error) {
      console.error("❌ RenderLogInbox.getLatest failed:", error);
      return null;
    }
  }

  async clearLatest({ chatId, senderIdStr }) {
    await this.ensureSchema();

    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    if (!scopeKey) return { ok: false, reason: "missing_scope" };

    try {
      const res = await this.pool.query(
        `
        DELETE FROM render_log_snapshots
        WHERE scope_key = $1
        `,
        [scopeKey]
      );

      return {
        ok: true,
        deleted: Number(res?.rowCount || 0) > 0,
      };
    } catch (error) {
      console.error("❌ RenderLogInbox.clearLatest failed:", error);
      return { ok: false, reason: "db_error" };
    }
  }

  async getDebugSnapshot(limit = 20) {
    await this.ensureSchema();

    const n = Number.isFinite(Number(limit))
      ? Math.max(1, Math.min(Math.trunc(Number(limit)), 100))
      : 20;

    try {
      const res = await this.pool.query(
        `
        SELECT
          scope_key,
          chat_id,
          sender_id_str,
          source,
          chars,
          created_at,
          updated_at
        FROM render_log_snapshots
        ORDER BY updated_at DESC
        LIMIT $1
        `,
        [n]
      );

      return {
        scopes: Number(res?.rowCount || 0),
        items: (res?.rows || []).map((row) => ({
          scopeKey: row.scope_key,
          chatId: row.chat_id,
          senderIdStr: row.sender_id_str,
          source: row.source,
          chars: row.chars,
          createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
          updatedAt: row.updated_at instanceof Date
            ? row.updated_at.toISOString()
            : String(row.updated_at),
        })),
      };
    } catch (error) {
      console.error("❌ RenderLogInbox.getDebugSnapshot failed:", error);
      return {
        scopes: 0,
        items: [],
        error: "db_error",
      };
    }
  }
}

export const renderLogInbox = new RenderLogInbox();

export default renderLogInbox;