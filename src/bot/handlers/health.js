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

  await bot.sendMessage(
    chatId,
    [
      "HEALTH: ok",
      `db: ${dbStatus}`,
      `last_snapshot_id: ${lastSnapshot}`,
      "last_error_at: unknown",
    ].join("\n")
  );
}
