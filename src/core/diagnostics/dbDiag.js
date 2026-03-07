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
      waitingCount: typeof pool.waitingCount === "number" ? pool.waitingCount : "—",
    };

    const lines = [];
    lines.push("🗄️ DB DIAG");
    lines.push("");
    lines.push(`chat_id: ${chatIdStr || "—"}`);
    lines.push(`global_user_id: ${globalUserId || "—"}`);
    lines.push(`db_now: ${safeTs(dbNow)}`);
    lines.push("");
    lines.push("pool:");
    lines.push(`total=${poolMeta.totalCount}`);
    lines.push(`idle=${poolMeta.idleCount}`);
    lines.push(`waiting=${poolMeta.waitingCount}`);
    lines.push("");
    lines.push("tables:");
    lines.push(
      `chat_messages=${chatMessagesRes.rows?.[0]?.n ?? 0} | last=${safeTs(chatMessagesRes.rows?.[0]?.last_created_at)}`
    );
    lines.push(
      `webhook_dedupe_events=${dedupeRes.rows?.[0]?.n ?? 0} | last=${safeTs(dedupeRes.rows?.[0]?.last_created_at)}`
    );
    lines.push(
      `users=${usersRes.rows?.[0]?.n ?? 0} | last=${safeTs(usersRes.rows?.[0]?.last_created_at)}`
    );
    lines.push(
      `tasks=${tasksRes.rows?.[0]?.n ?? 0} | last=${safeTs(tasksRes.rows?.[0]?.last_created_at)}`
    );
    lines.push(
      `sources=${sourcesRes.rows?.[0]?.n ?? 0} | last=${safeTs(sourcesRes.rows?.[0]?.last_updated_at)}`
    );
    lines.push(
      `source_cache=${sourceCacheRes.rows?.[0]?.n ?? 0} | last=${safeTs(sourceCacheRes.rows?.[0]?.last_cached_at)}`
    );
    lines.push(
      `source_checks=${sourceChecksRes.rows?.[0]?.n ?? 0} | last=${safeTs(sourceChecksRes.rows?.[0]?.last_created_at)}`
    );
    lines.push(
      `interaction_logs=${interactionLogsRes.rows?.[0]?.n ?? 0} | last=${safeTs(interactionLogsRes.rows?.[0]?.last_created_at)}`
    );

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_db",
    });

    return { handled: true, ok: true, stage: "7B.diag_db", result: "diag_db_replied", cmdBase };
  } catch (e) {
    console.error("handleDbDiag(/diag_db) failed:", e);
    await replyAndLog("⚠️ /diag_db failed. Проверь Render logs и доступность таблиц.", {
      cmd: cmdBase,
      event: "diag_db_failed",
    });
    return { handled: true, ok: false, reason: "diag_db_failed", cmdBase };
  }
}

export default handleDbDiag;