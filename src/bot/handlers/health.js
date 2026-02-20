// src/bot/handlers/health.js
// Stage 5 — Observability V1 (READ-ONLY)
// 5.5 /health + 5.8–5.13 metrics surface

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

function safeLine(s, max = 160) {
  const t = s === null || s === undefined ? "" : String(s);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

function mbFromBytes(bytes) {
  const b = Number(bytes);
  if (!Number.isFinite(b) || b < 0) return "unknown";
  return (b / (1024 * 1024)).toFixed(1);
}

export async function handleHealth({ bot, chatId }) {
  // ------------------
  // DB health
  // ------------------
  let dbStatus = "fail";
  try {
    await pool.query("SELECT 1");
    dbStatus = "ok";
  } catch (_) {
    dbStatus = "fail";
  }

  // ------------------
  // ✅ explicit table existence checks (READ-ONLY)
  // ------------------
  let errorEventsTable = "unknown";
  try {
    const t = await pool.query(
      `SELECT to_regclass('public.error_events') AS reg`
    );
    errorEventsTable = t?.rows?.[0]?.reg ? "yes" : "no";
  } catch (_) {
    errorEventsTable = "unknown";
  }

  let sourceRunsTable = "unknown";
  try {
    const t = await pool.query(
      `SELECT to_regclass('public.source_runs') AS reg`
    );
    sourceRunsTable = t?.rows?.[0]?.reg ? "yes" : "no";
  } catch (_) {
    sourceRunsTable = "unknown";
  }

  // ------------------
  // Repo snapshot id (optional)
  // ------------------
  let lastSnapshot = "unknown";
  try {
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;
    if (repo && branch) {
      // ✅ RepoIndexStore expects { pool }
      const store = new RepoIndexStore({ pool });
      const latest = await store.getLatestSnapshot({ repo, branch });
      if (latest?.id) lastSnapshot = String(latest.id);
    }
  } catch (_) {
    // keep unknown
  }

  // ------------------
  // error_events summary
  // ------------------
  let lastErrorAt = "unknown";
  let errorEventsCount = "unknown";
  let lastErrorType = "unknown";
  let lastErrorMsg = "unknown";

  try {
    const r = await pool.query(`
      SELECT COUNT(*)::int AS cnt, MAX(created_at) AS last_error_at
      FROM error_events
    `);

    const cnt = r?.rows?.[0]?.cnt;
    const v = r?.rows?.[0]?.last_error_at;

    if (Number.isInteger(cnt)) errorEventsCount = String(cnt);
    if (v) lastErrorAt = new Date(v).toISOString();
  } catch (_) {
    // keep unknown
  }

  try {
    const r2 = await pool.query(`
      SELECT event_type, message
      FROM error_events
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = r2?.rows?.[0];
    if (row?.event_type) lastErrorType = safeLine(row.event_type, 60);
    if (row?.message) lastErrorMsg = safeLine(row.message, 180);
  } catch (_) {
    // ignore
  }

  // ------------------
  // ✅ source_runs summary (defensive)
  // Primary: MAX(started_at)
  // Fallbacks: MAX(created_at) → MAX(finished_at)
  // ------------------
  let sourceRunsCount = "unknown";
  let lastSourceRunAt = "unknown";

  async function trySourceRunsQuery(maxCol) {
    const r = await pool.query(`
      SELECT COUNT(*)::int AS cnt, MAX(${maxCol}) AS last_run_at
      FROM source_runs
    `);

    const cnt = r?.rows?.[0]?.cnt;
    const v = r?.rows?.[0]?.last_run_at;

    if (Number.isInteger(cnt)) sourceRunsCount = String(cnt);
    if (v) lastSourceRunAt = new Date(v).toISOString();
  }

  try {
    if (sourceRunsTable === "yes") {
      try {
        await trySourceRunsQuery("started_at");
      } catch (_) {
        try {
          await trySourceRunsQuery("created_at");
        } catch (_) {
          try {
            await trySourceRunsQuery("finished_at");
          } catch (_) {
            // keep unknown
          }
        }
      }
    }
  } catch (_) {
    // keep unknown
  }

  // ------------------
  // Stage 5.8 — chat_messages_count (proxy via interaction_logs)
  // ------------------
  let chatMessagesCount24h = "unknown";
  let chatMessagesCountTotal = "unknown";

  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::bigint AS total,
        SUM(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 ELSE 0 END)::bigint AS last24h
      FROM interaction_logs
      WHERE task_type = 'chat'
    `);

    const row = r?.rows?.[0] || {};
    chatMessagesCountTotal = String(row.total ?? 0);
    chatMessagesCount24h = String(row.last24h ?? 0);
  } catch (_) {
    // keep unknown
  }

  // Stage 5.9–5.12 hooks
  const recallRequests = 0;
  const recallErrors = 0;
  const alreadySeenHits = 0;
  const alreadySeenCooldownSkips = 0;

  // ------------------
  // Stage 5.14 — scaling metrics (SKELETON)
  // ------------------
  const queueDepth = "unknown";
  const dlqCount = "unknown";
  const webhookDedupeHits = "unknown";
  const lockContention = "unknown";
  
  // ------------------
  // Stage 5.13 — db_size_warning (70% / 85%)
  // ------------------
  let dbSizeMb = "unknown";
  let dbLimitMb = "unknown";
  let dbUsagePct = "unknown";
  let dbSizeWarning = "none";

  try {
    const r = await pool.query(
      `SELECT pg_database_size(current_database())::bigint AS bytes`
    );
    const bytes = r?.rows?.[0]?.bytes;
    dbSizeMb = mbFromBytes(bytes);

    const limitEnv = String(process.env.DB_SIZE_LIMIT_MB || "").trim();
    if (limitEnv) {
      const limit = Number(limitEnv);
      if (Number.isFinite(limit) && limit > 0) {
        dbLimitMb = String(limit);
        const size = Number(dbSizeMb);
        if (Number.isFinite(size)) {
          const pct = (size / limit) * 100;
          dbUsagePct = pct.toFixed(1);

          if (pct >= 85) dbSizeWarning = "CRITICAL(>=85%)";
          else if (pct >= 70) dbSizeWarning = "WARN(>=70%)";
          else dbSizeWarning = "OK(<70%)";
        }
      }
    }
  } catch (_) {
    // keep unknown
  }

  await bot.sendMessage(
    chatId,
    [
      "HEALTH: ok",
      `db: ${dbStatus}`,
      `last_snapshot_id: ${lastSnapshot}`,

      `error_events_table: ${errorEventsTable}`,
      `source_runs_table: ${sourceRunsTable}`,

      `error_events_count: ${errorEventsCount}`,
      `last_error_at: ${lastErrorAt}`,
      `last_error_type: ${lastErrorType}`,
      `last_error_msg: ${lastErrorMsg}`,

      `source_runs_count: ${sourceRunsCount}`,
      `last_source_run_at: ${lastSourceRunAt}`,

      `chat_messages_count_total: ${chatMessagesCountTotal}`,
      `chat_messages_count_24h: ${chatMessagesCount24h}`,

      `recall_requests: ${recallRequests}`,
      `recall_errors: ${recallErrors}`,
      `already_seen_hits: ${alreadySeenHits}`,
      `already_seen_cooldown_skips: ${alreadySeenCooldownSkips}`,
      `queue_depth: ${queueDepth}`,
      `dlq_count: ${dlqCount}`,
      `webhook_dedupe_hits: ${webhookDedupeHits}`,
      `lock_contention: ${lockContention}`,

      `db_size_mb: ${dbSizeMb}`,
      `db_limit_mb: ${dbLimitMb}`,
      `db_usage_pct: ${dbUsagePct}`,
      `db_size_warning: ${dbSizeWarning}`,
    ].join("\n")
  );
}
