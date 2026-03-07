// src/core/diagnostics/dbDiag.js
// STAGE 7B — /diag_db
// Safe DB diagnostic for enforced transport path.

import pool from "../../../db.js";

function safeTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

export async function handleDbDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    globalUserId,
    chatIdStr,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_db") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_db доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });
    return { handled: true, ok: true, stage: "7B.diag_db", result: "private_only_block", cmdBase };
  }

  if (!isMonarchUser) {
    await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
      cmd: cmdBase,
      event: "monarch_only_block",
    });
    return { handled: true, ok: true, stage: "7B.diag_db", result: "monarch_only_block", cmdBase };
  }

  try {
    const [
      nowRes,
      chatMessagesRes,
      dedupeRes,
      usersRes,
      tasksRes,
      sourcesRes,
      sourceCacheRes,
      sourceChecksRes,
      interactionLogsRes,
    ] = await Promise.all([
      pool.query(`SELECT NOW() AS now`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM chat_messages`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM webhook_dedupe_events`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM users`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM tasks`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(updated_at) AS last_updated_at FROM sources`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(cached_at) AS last_cached_at FROM source_cache`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM source_checks`),
      pool.query(`SELECT COUNT(*)::int AS n, MAX(created_at) AS last_created_at FROM interaction_logs`),
    ]);

    const dbNow = nowRes.rows?.[0]?.now ?? null;

    const poolMeta = {
      totalCount: typeof pool.totalCount === "number" ? pool.totalCount : "—",
      idleCount: typeof pool.idleCount === "number" ? pool.idleCount : "—",
      waitingCount: typeof pool.waitingCount === "number" ? pool.waitingCount : "—