// src/core/diagnostics/allDiag.js
// STAGE 7B — /diag_all
// Unified lightweight SG health check.
// Manual-only, monarch-only, private chat only.
// Must not run heavy DB queries.

import os from "os";
import process from "process";
import pool from "../../../db.js";
import { isTransportEnforced } from "../../transport/transportConfig.js";

function isOk(value) {
  return value ? "OK" : "FAIL";
}

function safeTs(value) {
  try {
    return value ? new Date(value).toISOString() : "—";
  } catch {
    return "—";
  }
}

export async function handleAllDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    transport,
    trimmed,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_all") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_all доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_all",
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
      stage: "7B.diag_all",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();
    const isCommand = String(trimmed || "").startsWith("/");

    const [
      nowRes,
      chatMessagesRes,
      sourcesRes,
      tasksRes,
    ] = await Promise.all([
      pool.query(`SELECT NOW() AS now`),
      pool.query(`SELECT COUNT(*)::int AS n FROM chat_messages`),
      pool.query(`SELECT COUNT(*)::int AS n FROM sources`),
      pool.query(`SELECT COUNT(*)::int AS n FROM tasks`),
    ]);

    const dbNow = nowRes.rows?.[0]?.now ?? null;
    const chatMessagesCount = Number(chatMessagesRes.rows?.[0]?.n ?? 0);
    const sourcesCount = Number(sourcesRes.rows?.[0]?.n ?? 0);
    const tasksCount = Number(tasksRes.rows?.[0]?.n ?? 0);

    const transportOk =
      enforced === true && String(transport || "") === "telegram";

    const coreOk =
      isCommand &&
      typeof process.version === "string" &&
      typeof process.uptime === "function";

    const dbOk =
      Boolean(dbNow) &&
      typeof pool.totalCount === "number" &&
      typeof pool.idleCount === "number" &&
      typeof pool.waitingCount === "number";

    const memoryOk = chatMessagesCount >= 0;
    const sourcesOk = sourcesCount >= 0;
    const tasksOk = tasksCount >= 0;

    const runtimeOk =
      process.uptime() >= 0 &&
      Array.isArray(os.loadavg()) &&
      typeof process.memoryUsage === "function";

    const allHealthy =
      transportOk &&
      coreOk &&
      dbOk &&
      memoryOk &&
      sourcesOk &&
      tasksOk &&
      runtimeOk;

    const lines = [];
    lines.push("🛡️ SG STATUS");
    lines.push("");
    lines.push(`transport: ${isOk(transportOk)}`);
    lines.push(`core: ${isOk(coreOk)}`);
    lines.push(`db: ${isOk(dbOk)}`);
    lines.push(`memory: ${isOk(memoryOk)}`);
    lines.push(`sources: ${isOk(sourcesOk)}`);
    lines.push(`tasks: ${isOk(tasksOk)}`);
    lines.push(`runtime: ${isOk(runtimeOk)}`);
    lines.push("");
    lines.push(`system_state: ${allHealthy ? "HEALTHY" : "DEGRADED"}`);
    lines.push("");
    lines.push("meta:");
    lines.push(`db_now=${safeTs(dbNow)}`);
    lines.push(`transport_enforced=${String(enforced)}`);
    lines.push(`chat_messages=${chatMessagesCount}`);
    lines.push(`sources=${sourcesCount}`);
    lines.push(`tasks=${tasksCount}`);
    lines.push(`pool_total=${typeof pool.totalCount === "number" ? pool.totalCount : "—"}`);
    lines.push(`pool_idle=${typeof pool.idleCount === "number" ? pool.idleCount : "—"}`);
    lines.push(`pool_waiting=${typeof pool.waitingCount === "number" ? pool.waitingCount : "—"}`);

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_all",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_all",
      result: "diag_all_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleAllDiag(/diag_all) failed:", e);

    await replyAndLog("⚠️ /diag_all failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_all_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_all_failed",
      cmdBase,
    };
  }
}

export default handleAllDiag;