// src/bot/handlers/health.js
// Stage 5 — Observability V1 (MINIMAL)
// NOTE: contains TEMP one-time write to error_events when table is empty (verification only)

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { ErrorEventsRepo } from "../../db/errorEventsRepo.js";

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

  try {
    const r = await pool.query(`
      SELECT COUNT(*)::int AS cnt, MAX(created_at) AS last_error_at
      FROM error_events
    `);

    const cnt = r?.rows?.[0]?.cnt;
    const v = r?.rows?.[0]?.last_error_at;

    if (Number.isInteger(cnt)) errorEventsCount = String(cnt);
    if (v) lastErrorAt = new Date(v).toISOString();

    // TEMP: one-time test write if table is empty
    if (cnt === 0) {
      try {
        const repo = new ErrorEventsRepo(pool);
        await repo.write({
          scope: "runtime",
          eventType: "MANUAL_TEST",
          severity: "warn",
          message: "Manual test from /health (one-time when empty)",
          context: { source: "health_command" },
        });

        // Re-read after insert (so we don't lie)
        const rr = await pool.query(`
          SELECT COUNT(*)::int AS cnt, MAX(created_at) AS last_error_at
          FROM error_events
        `);

        const cnt2 = rr?.rows?.[0]?.cnt;
        const v2 = rr?.rows?.[0]?.last_error_at;

        if (Number.isInteger(cnt2)) errorEventsCount = String(cnt2);
        if (v2) lastErrorAt = new Date(v2).toISOString();
      } catch (_) {
        // ignore (health must not crash)
      }
    }
  } catch (_) {
    // keep unknown (table missing / permission / etc.)
  }

  await bot.sendMessage(
    chatId,
    [
      "HEALTH: ok",
      `db: ${dbStatus}`,
      `last_snapshot_id: ${lastSnapshot}`,
      `error_events_count: ${errorEventsCount}`,
      `last_error_at: ${lastErrorAt}`,
    ].join("\n")
  );
}
