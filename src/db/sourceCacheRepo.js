// src/db/sourceCacheRepo.js
// ============================================================================
// STAGE 10.15.1 — Source Cache Repo (storage layer for source cache)
// PURPOSE:
// - normalize source cache access behind one repo
// - support cache_key per request shape
// - keep logic deterministic and minimal
//
// IMPORTANT:
// - this file does NOT fetch network data
// - this file provides storage/read-write only
// - runtime cache-first decisions are made in SourceService
// - current change adds DB diagnostics only
// ============================================================================

import pool from "../../db.js";
import { envIntRange } from "../core/config.js";

const SOURCE_CACHE_DEFAULT_TTL_SEC = envIntRange(
  "SOURCE_CACHE_DEFAULT_TTL_SEC",
  20,
  { min: 5, max: 3600 }
);

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeString(item).toLowerCase())
    .filter(Boolean);
}

function safeErrorMessage(error) {
  return error?.message ? String(error.message) : "unknown_error";
}

function logInfo(event, payload) {
  try {
    console.info(event, payload);
  } catch (_) {}
}

function logError(event, payload) {
  try {
    console.error(event, payload);
  } catch (_) {}
}

export function buildSourceCacheKey({
  sourceKey = "",
  ids = [],
  vsCurrencies = [],
}) {
  const source = normalizeString(sourceKey).toLowerCase();
  const idsNorm = [...new Set(normalizeStringArray(ids))].sort();
  const vsNorm = [...new Set(normalizeStringArray(vsCurrencies))].sort();

  return [
    `source:${source || "unknown"}`,
    `ids:${idsNorm.join(",") || "-"}`,
    `vs:${vsNorm.join(",") || "-"}`,
  ].join("|");
}

export async function getSourceCacheEntry({ cacheKey }) {
  const key = normalizeString(cacheKey);

  if (!key) {
    return {
      ok: false,
      hit: false,
      stale: false,
      reason: "missing_cache_key",
      entry: null,
    };
  }

  logInfo("SOURCE_CACHE_DB_READ_START", {
    cacheKey: key,
  });

  try {
    const res = await pool.query(
      `
      SELECT
        id,
        source_key,
        cache_key,
        payload,
        fetched_at,
        ttl_sec,
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - fetched_at)))
        )::int AS age_sec
      FROM source_cache
      WHERE cache_key = $1
      LIMIT 1
      `,
      [key]
    );

    const row = res?.rows?.[0] || null;

    logInfo("SOURCE_CACHE_DB_READ_RESULT", {
      cacheKey: key,
      rowCount: Number.isFinite(res?.rowCount) ? res.rowCount : null,
      hasRow: Boolean(row),
      rowId: row?.id ?? null,
      rowSourceKey: row?.source_key ?? null,
      rowCacheKey: row?.cache_key ?? null,
      hasPayload: Boolean(row?.payload),
      rawTtlSec: row?.ttl_sec ?? null,
      rawFetchedAt: row?.fetched_at
        ? new Date(row.fetched_at).toISOString()
        : null,
    });

    if (!row) {
      return {
        ok: true,
        hit: false,
        stale: false,
        reason: "cache_miss",
        entry: null,
      };
    }

    const ttlSec =
      Number.isFinite(Number(row.ttl_sec)) && Number(row.ttl_sec) > 0
        ? Math.trunc(Number(row.ttl_sec))
        : SOURCE_CACHE_DEFAULT_TTL_SEC;

    const ageSec =
      Number.isFinite(Number(row.age_sec)) && Number(row.age_sec) >= 0
        ? Math.trunc(Number(row.age_sec))
        : 0;

    const stale = ageSec >= ttlSec;

    return {
      ok: true,
      hit: true,
      stale,
      reason: stale ? "cache_stale" : "cache_hit",
      entry: {
        id: row.id,
        sourceKey: row.source_key,
        cacheKey: row.cache_key,
        payload: row.payload || null,
        fetchedAt: row.fetched_at ? new Date(row.fetched_at).toISOString() : null,
        ttlSec,
        ageSec,
      },
    };
  } catch (error) {
    logError("SOURCE_CACHE_DB_READ_ERROR", {
      cacheKey: key,
      message: safeErrorMessage(error),
    });

    return {
      ok: false,
      hit: false,
      stale: false,
      reason: "cache_read_error",
      error: safeErrorMessage(error),
      entry: null,
    };
  }
}

export async function upsertSourceCacheEntry({
  sourceKey,
  cacheKey,
  payload,
  ttlSec = SOURCE_CACHE_DEFAULT_TTL_SEC,
}) {
  const source = normalizeString(sourceKey).toLowerCase();
  const key = normalizeString(cacheKey);
  const ttl =
    Number.isFinite(Number(ttlSec)) && Number(ttlSec) > 0
      ? Math.trunc(Number(ttlSec))
      : SOURCE_CACHE_DEFAULT_TTL_SEC;

  if (!source) {
    return {
      ok: false,
      reason: "missing_source_key",
    };
  }

  if (!key) {
    return {
      ok: false,
      reason: "missing_cache_key",
    };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      reason: "invalid_payload",
    };
  }

  logInfo("SOURCE_CACHE_DB_WRITE_START", {
    sourceKey: source,
    cacheKey: key,
    ttlSec: ttl,
    payloadSourceKey: payload?.sourceKey || null,
    payloadOk: payload?.ok === true,
    hasContent: typeof payload?.content === "string" && payload.content.length > 0,
  });

  try {
    const res = await pool.query(
      `
      INSERT INTO source_cache (
        source_key,
        cache_key,
        payload,
        fetched_at,
        ttl_sec,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, NOW(), $4, NOW(), NOW())
      ON CONFLICT (cache_key)
      DO UPDATE SET
        source_key = EXCLUDED.source_key,
        payload = EXCLUDED.payload,
        fetched_at = NOW(),
        ttl_sec = EXCLUDED.ttl_sec,
        updated_at = NOW()
      RETURNING
        id,
        source_key,
        cache_key,
        payload,
        fetched_at,
        ttl_sec
      `,
      [source, key, JSON.stringify(payload), ttl]
    );

    const row = res?.rows?.[0] || null;

    logInfo("SOURCE_CACHE_DB_WRITE_RESULT", {
      sourceKey: source,
      cacheKey: key,
      rowCount: Number.isFinite(res?.rowCount) ? res.rowCount : null,
      hasRow: Boolean(row),
      rowId: row?.id ?? null,
      rowSourceKey: row?.source_key ?? null,
      rowCacheKey: row?.cache_key ?? null,
      rowTtlSec: row?.ttl_sec ?? null,
      rowFetchedAt: row?.fetched_at
        ? new Date(row.fetched_at).toISOString()
        : null,
      hasPayload: Boolean(row?.payload),
      payloadSourceKey: row?.payload?.sourceKey || null,
    });

    return {
      ok: true,
      reason: "cache_saved",
      entry: row
        ? {
            id: row.id,
            sourceKey: row.source_key,
            cacheKey: row.cache_key,
            payload: row.payload || null,
            fetchedAt: row.fetched_at
              ? new Date(row.fetched_at).toISOString()
              : null,
            ttlSec: row.ttl_sec,
          }
        : null,
    };
  } catch (error) {
    logError("SOURCE_CACHE_DB_WRITE_ERROR", {
      sourceKey: source,
      cacheKey: key,
      message: safeErrorMessage(error),
    });

    return {
      ok: false,
      reason: "cache_write_error",
      error: safeErrorMessage(error),
    };
  }
}

export async function deleteSourceCacheEntry({ cacheKey }) {
  const key = normalizeString(cacheKey);

  if (!key) {
    return {
      ok: false,
      reason: "missing_cache_key",
    };
  }

  logInfo("SOURCE_CACHE_DB_DELETE_START", {
    cacheKey: key,
  });

  try {
    const res = await pool.query(
      `
      DELETE FROM source_cache
      WHERE cache_key = $1
      RETURNING id
      `,
      [key]
    );

    logInfo("SOURCE_CACHE_DB_DELETE_RESULT", {
      cacheKey: key,
      rowCount: Number.isFinite(res?.rowCount) ? res.rowCount : null,
      deleted: res.rowCount > 0,
    });

    return {
      ok: true,
      reason: res.rowCount > 0 ? "cache_deleted" : "cache_not_found",
      deleted: res.rowCount > 0,
    };
  } catch (error) {
    logError("SOURCE_CACHE_DB_DELETE_ERROR", {
      cacheKey: key,
      message: safeErrorMessage(error),
    });

    return {
      ok: false,
      reason: "cache_delete_error",
      error: safeErrorMessage(error),
    };
  }
}

export default {
  buildSourceCacheKey,
  getSourceCacheEntry,
  upsertSourceCacheEntry,
  deleteSourceCacheEntry,
};