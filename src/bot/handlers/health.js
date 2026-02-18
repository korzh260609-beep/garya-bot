// src/bot/handlers/health.js
// Stage 5 — Observability V1 (MINIMAL, READ-ONLY)

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

function safeLine(s, max = 160) {
  const t = s === null || s === undefined ? "" : String(s);
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export async function handleHealth({ bot, chatId }) {
  let dbStatus = "fail";
  try {
    await pool.query("SELECT 1");
    dbStatus = "ok";
  } catch (_) {
    dbStatus = "fail";
  }

  let lastSnapshot = "unknown";
  try {
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;
    if (repo && branch) {
      const store = new RepoIndexStore(pool);
      const latest = await store.getLatestSnapshot({ repo, branch });
      if (latest?.id) lastSnapshot = String(latest.id);
    }
  } catch (_) {
    // keep unknown
  }

  let lastErrorAt = "unknown";
  let errorEventsCount = "unknown";

  // NEW: show last error summary (helps debug silent commands)
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
    // keep unknown (table missing / permission / etc.)
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

  await bot.sendMessage(
    chatId,
    [
      "HEALTH: ok",
      `db: ${dbStatus}`,
      `last_snapshot_id: ${lastSnapshot}`,
      `error_events_count: ${errorEventsCount}`,
      `last_error_at: ${lastErrorAt}`,
      `last_error_type: ${lastErrorType}`,
      `last_error_msg: ${lastErrorMsg}`,
    ].join("\n")
  );
}
