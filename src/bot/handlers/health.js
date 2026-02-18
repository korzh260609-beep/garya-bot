// src/bot/handlers/health.js
// Stage 5 — Observability V1 (MINIMAL, READ-ONLY)

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

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
  try {
    // If table exists + has rows — show latest error timestamp
    const r = await pool.query(
      "SELECT MAX(created_at) AS last_error_at FROM error_events"
    );
    const v = r?.rows?.[0]?.last_error_at;
    if (v) lastErrorAt = new Date(v).toISOString();
  } catch (_) {
    // keep unknown (e.g. table missing / permission / cold start edge)
  }

  await bot.sendMessage(
    chatId,
    [
      "HEALTH: ok",
      `db: ${dbStatus}`,
      `last_snapshot_id: ${lastSnapshot}`,
      `last_error_at: ${lastErrorAt}`,
    ].join("\n")
  );
}
