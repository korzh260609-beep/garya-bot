// src/core/diagnostics/systemDiag.js
// STAGE 7B — /diag_system
// Aggregated safe system diagnostic for enforced transport path.

import os from "os";
import process from "process";
import pool from "../../../db.js";
import { isTransportEnforced } from "../../transport/transportConfig.js";

function safeTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

function safeMb(bytes) {
  const n = Number(bytes || 0);
  return `${Math.round((n / 1024 / 1024) * 10) / 10} MB`;
}

function formatUptime(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec || 0)));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
}

export async function handleSystemDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    globalUserId,
    chatIdStr,
    senderId,
    messageId,
    transport,
    chatType,
    trimmed,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_system") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_system доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });
    return {
      handled: true,
      ok: true,
      stage: "7B.diag_system",
      result: "private_only_block",
      cmdBase,
    };
  }

  if (!isMonarchUser) {
    await replyAndLog("⛔ Недостаточно прав (monarch-only).", {
      cmd: cmdBase,
      event: "monarch_only_block",
    });
    return {
      handled: true,
      ok: true,
      stage: "7B.diag_system",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();
    const isCommand = String(trimmed || "").startsWith("/");
    const mu = process.memoryUsage();

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

    const lines = [];
    lines.push("🛠️ SYSTEM DIAG");
    lines.push("");

    lines.push("context:");
    lines.push(`chat_id=${chatIdStr || "—"}`);
    lines.push(`global_user_id=${globalUserId || "—"}`);
    lines.push(`sender_id=${senderId || "—"}`);
    lines.push(`message_id=${messageId || "—"}`);
    lines.push("");

    lines.push("runtime:");
    lines.push(`db_now=${safeTs(nowRes.rows?.[0]?.now)}`);
    lines.push(`node=${process.version}`);
    lines.push(`pid=${process.pid}`);
    lines.push(`platform=${process.platform}`);
    lines.push(`arch=${process.arch}`);
    lines.push(`uptime=${formatUptime(process.uptime())}`);
    lines.push(`host_uptime=${formatUptime(os.uptime())}`);
    lines.push(`node_env=${process.env.NODE_ENV || "—"}`);
    lines.push("");

    lines.push("memory:");
    lines.push(`rss=${safeMb(mu.rss)}`);
    lines.push(`heap_total=${safeMb(mu.heapTotal)}`);
    lines.push(`heap_used=${safeMb(mu.heapUsed)}`);
    lines.push(`external=${safeMb(mu.external)}`);
    lines.push(`array_buffers=${safeMb(mu.arrayBuffers)}`);
    lines.push("");

    lines.push("transport:");
    lines.push(`transport=${transport || "—"}`);
    lines.push(`chat_type=${chatType || "—"}`);
    lines.push(`is_command=${String(isCommand)}`);
    lines.push(`transport_enforced=${String(enforced)}`);
    lines.push(`adapter=TelegramAdapter`);
    lines.push(`core_entry=handleMessage`);
    lines.push(`messageRouter_attached=${enforced ? "false" : "true"}`);
    lines.push("");

    lines.push("db_pool:");
    lines.push(`total=${typeof pool.totalCount === "number" ? pool.totalCount : "—"}`);
    lines.push(`idle=${typeof pool.idleCount === "number" ? pool.idleCount : "—"}`);
    lines.push(`waiting=${typeof pool.waitingCount === "number" ? pool.waitingCount : "—"}`);
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
    lines.push("");

    lines.push("pipeline:");
    if (enforced) {
      lines.push("Telegram");
      lines.push("→ TelegramAdapter");
      lines.push("→ UnifiedContext");
      lines.push("→ CoreContext");
      lines.push("→ handleMessage(core)");
      lines.push("→ diagnostics / commands / chat");
      lines.push("→ replyAndLog");
      lines.push("→ Telegram reply");
    } else {
      lines.push("Telegram");
      lines.push("→ messageRouter");
      lines.push("→ handlers");
      lines.push("→ reply");
    }

    lines.push("");
    lines.push("cpu:");
    lines.push(`loadavg=${os.loadavg().map((x) => x.toFixed(2)).join(", ")}`);
    lines.push(`cpus=${Array.isArray(os.cpus()) ? os.cpus().length : "—"}`);
    lines.push("");
    lines.push("stage_hint:");
    lines.push("Stage 7B foundation / enforced transport runtime");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_system",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_system",
      result: "diag_system_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleSystemDiag(/diag_system) failed:", e);
    await replyAndLog("⚠️ /diag_system failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_system_failed",
    });
    return {
      handled: true,
      ok: false,
      reason: "diag_system_failed",
      cmdBase,
    };
  }
}

export default handleSystemDiag;