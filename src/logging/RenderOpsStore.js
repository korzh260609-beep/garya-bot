// ============================================================================
// src/logging/RenderOpsStore.js
// STAGE SKELETON — persistent rolling storage for render error/deploy snapshots
// Purpose:
// - keep only latest error snapshots per source_key
// - keep only last 10 deploy snapshots per source_key
// - support bot inspection commands
// IMPORTANT:
// - rolling retention, not infinite archive
// - one source_key can represent one render service / environment
// ============================================================================

import pool from "../../db.js";

const ERROR_RETENTION_LIMIT = 20;
const DEPLOY_RETENTION_LIMIT = 10;

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeText(v) {
  return safeStr(v).trim();
}

function normalizeStatus(v) {
  const s = normalizeText(v).toLowerCase();
  if (!s) return "unknown";
  if (["success", "ok", "passed", "healthy"].includes(s)) return "success";
  if (["failed", "fail", "error", "crash"].includes(s)) return "failed";
  if (["building", "deploying", "running", "pending"].includes(s)) return s;
  return s;
}

function normalizeMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }
  return meta;
}

class RenderOpsStore {
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
        CREATE TABLE IF NOT EXISTS render_error_snapshots (
          id BIGSERIAL PRIMARY KEY,
          source_key TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'unknown',
          error_kind TEXT NOT NULL DEFAULT 'unknown',
          error_headline TEXT NOT NULL DEFAULT 'unknown',
          candidate_path TEXT,
          exact_line INTEGER,
          confidence TEXT NOT NULL DEFAULT 'very_low',
          log_text TEXT NOT NULL,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_render_error_snapshots_source_created
        ON render_error_snapshots (source_key, created_at DESC, id DESC);
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS render_deploy_snapshots (
          id BIGSERIAL PRIMARY KEY,
          source_key TEXT NOT NULL,
          deploy_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'unknown',
          top_error TEXT,
          candidate_path TEXT,
          exact_line INTEGER,
          confidence TEXT NOT NULL DEFAULT 'very_low',
          log_text TEXT,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (source_key, deploy_id)
        );
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_render_deploy_snapshots_source_updated
        ON render_deploy_snapshots (source_key, updated_at DESC, id DESC);
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

  async trimErrorRetention(sourceKey, keep = ERROR_RETENTION_LIMIT) {
    await this.pool.query(
      `
      DELETE FROM render_error_snapshots
      WHERE source_key = $1
        AND id NOT IN (
          SELECT id
          FROM render_error_snapshots
          WHERE source_key = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2
        )
      `,
      [sourceKey, keep]
    );
  }

  async trimDeployRetention(sourceKey, keep = DEPLOY_RETENTION_LIMIT) {
    await this.pool.query(
      `
      DELETE FROM render_deploy_snapshots
      WHERE source_key = $1
        AND id NOT IN (
          SELECT id
          FROM render_deploy_snapshots
          WHERE source_key = $1
          ORDER BY updated_at DESC, id DESC
          LIMIT $2
        )
      `,
      [sourceKey, keep]
    );
  }

  async addErrorSnapshot({
    sourceKey = "render_primary",
    severity = "unknown",
    errorKind = "unknown",
    errorHeadline = "unknown",
    candidatePath = null,
    exactLine = null,
    confidence = "very_low",
    logText = "",
    meta = {},
  }) {
    await this.ensureSchema();

    const normalizedSourceKey = normalizeText(sourceKey) || "render_primary";
    const normalizedLogText = normalizeText(logText);
    const normalizedMeta = normalizeMeta(meta);

    if (!normalizedLogText) {
      return { ok: false, reason: "missing_log_text" };
    }

    const res = await this.pool.query(
      `
      INSERT INTO render_error_snapshots (
        source_key,
        severity,
        error_kind,
        error_headline,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
      RETURNING
        id,
        source_key,
        severity,
        error_kind,
        error_headline,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at
      `,
      [
        normalizedSourceKey,
        normalizeText(severity) || "unknown",
        normalizeText(errorKind) || "unknown",
        normalizeText(errorHeadline) || "unknown",
        candidatePath ? normalizeText(candidatePath) : null,
        Number.isFinite(Number(exactLine)) ? Math.trunc(Number(exactLine)) : null,
        normalizeText(confidence) || "very_low",
        normalizedLogText,
        JSON.stringify(normalizedMeta),
      ]
    );

    await this.trimErrorRetention(normalizedSourceKey, ERROR_RETENTION_LIMIT);

    return {
      ok: true,
      row: res?.rows?.[0] || null,
      retentionLimit: ERROR_RETENTION_LIMIT,
    };
  }

  async upsertDeploySnapshot({
    sourceKey = "render_primary",
    deployId,
    status = "unknown",
    topError = null,
    candidatePath = null,
    exactLine = null,
    confidence = "very_low",
    logText = "",
    meta = {},
  }) {
    await this.ensureSchema();

    const normalizedSourceKey = normalizeText(sourceKey) || "render_primary";
    const normalizedDeployId =
      normalizeText(deployId) || `deploy_${Date.now()}`;
    const normalizedStatus = normalizeStatus(status);
    const normalizedTopError = normalizeText(topError) || null;
    const normalizedLogText = normalizeText(logText) || null;
    const normalizedMeta = normalizeMeta(meta);

    const res = await this.pool.query(
      `
      INSERT INTO render_deploy_snapshots (
        source_key,
        deploy_id,
        status,
        top_error,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW(), NOW())
      ON CONFLICT (source_key, deploy_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        top_error = EXCLUDED.top_error,
        candidate_path = EXCLUDED.candidate_path,
        exact_line = EXCLUDED.exact_line,
        confidence = EXCLUDED.confidence,
        log_text = EXCLUDED.log_text,
        meta = EXCLUDED.meta,
        updated_at = NOW()
      RETURNING
        id,
        source_key,
        deploy_id,
        status,
        top_error,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at,
        updated_at
      `,
      [
        normalizedSourceKey,
        normalizedDeployId,
        normalizedStatus,
        normalizedTopError,
        candidatePath ? normalizeText(candidatePath) : null,
        Number.isFinite(Number(exactLine)) ? Math.trunc(Number(exactLine)) : null,
        normalizeText(confidence) || "very_low",
        normalizedLogText,
        JSON.stringify(normalizedMeta),
      ]
    );

    await this.trimDeployRetention(normalizedSourceKey, DEPLOY_RETENTION_LIMIT);

    return {
      ok: true,
      row: res?.rows?.[0] || null,
      retentionLimit: DEPLOY_RETENTION_LIMIT,
    };
  }

  async getRecentErrors({ sourceKey = "render_primary", limit = 10 } = {}) {
    await this.ensureSchema();

    const normalizedSourceKey = normalizeText(sourceKey) || "render_primary";
    const n = Math.max(1, Math.min(Math.trunc(Number(limit) || 10), 50));

    const res = await this.pool.query(
      `
      SELECT
        id,
        source_key,
        severity,
        error_kind,
        error_headline,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at
      FROM render_error_snapshots
      WHERE source_key = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
      `,
      [normalizedSourceKey, n]
    );

    return res?.rows || [];
  }

  async getRecentDeploys({ sourceKey = "render_primary", limit = 10 } = {}) {
    await this.ensureSchema();

    const normalizedSourceKey = normalizeText(sourceKey) || "render_primary";
    const n = Math.max(1, Math.min(Math.trunc(Number(limit) || 10), 20));

    const res = await this.pool.query(
      `
      SELECT
        id,
        source_key,
        deploy_id,
        status,
        top_error,
        candidate_path,
        exact_line,
        confidence,
        log_text,
        meta,
        created_at,
        updated_at
      FROM render_deploy_snapshots
      WHERE source_key = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT $2
      `,
      [normalizedSourceKey, n]
    );

    return res?.rows || [];
  }
}

export const renderOpsStore = new RenderOpsStore();

export default renderOpsStore;