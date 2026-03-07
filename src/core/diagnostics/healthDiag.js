// src/core/diagnostics/healthDiag.js
// STAGE 7B — /diag_health
// Lightweight runtime health check.
// Manual-only, monarch-only, private chat only.
// No heavy queries. No external calls. No AI calls.

import os from "os";
import process from "process";
import pool from "../../../db.js";
import { isTransportEnforced } from "../../transport/transportConfig.js";

function safeMs(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  return `${Math.round(n)} ms`;
}

function safeMb(bytes) {
  const n = Number(bytes || 0);
  return `${Math.round((n / 1024 / 1024) * 10) / 10} MB`;
}

function formatStatus(ok) {
  return ok ? "OK" : "WARN";
}

function classifyEventLoopLag(ms) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= 50) return "OK";
  return "WARN";
}

function classifyDbPing(ms) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= 300) return "OK";
  return "WARN";
}

function classifyHeapUsedMb(mb) {
  if (!Number.isFinite(mb)) return "WARN";
  if (mb <= 300) return "OK";
  return "WARN";
}

function classifyLoad(avg1, cpuCount) {
  if (!Number.isFinite(avg1) || !Number.isFinite(cpuCount) || cpuCount <= 0) {
    return "WARN";
  }

  if (avg1 <= cpuCount) return "OK";
  return "WARN";
}

export async function handleHealthDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_health") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_health доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_health",
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
      stage: "7B.diag_health",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();
    const mu = process.memoryUsage();

    const heapUsedMb = Math.round((Number(mu.heapUsed || 0) / 1024 / 1024) * 10) / 10;
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 0;
    const load1 = Array.isArray(os.loadavg()) ? Number(os.loadavg()[0] || 0) : NaN;

    // 1) DB ping latency
    const dbStart = process.hrtime.bigint();
    await pool.query(`SELECT 1 AS ok`);
    const dbPingMs = Number(process.hrtime.bigint() - dbStart) / 1e6;

    // 2) Event loop lag (cheap single-sample)
    const loopStart = process.hrtime.bigint();
    const eventLoopLagMs = await new Promise((resolve) => {
      setTimeout(() => {
        const diffMs = Number(process.hrtime.bigint() - loopStart) / 1e6;
        resolve(Math.max(0, diffMs));
      }, 0);
    });

    const dbStatus = classifyDbPing(dbPingMs);
    const loopStatus = classifyEventLoopLag(eventLoopLagMs);
    const heapStatus = classifyHeapUsedMb(heapUsedMb);
    const loadStatus = classifyLoad(load1, cpuCount);
    const transportStatus = enforced ? "OK" : "WARN";

    const healthy =
      dbStatus === "OK" &&
      loopStatus === "OK" &&
      heapStatus === "OK" &&
      loadStatus === "OK" &&
      transportStatus === "OK";

    const lines = [];
    lines.push("❤️ SG HEALTH");
    lines.push("");
    lines.push(`transport: ${transportStatus}`);
    lines.push(`db_ping: ${dbStatus}`);
    lines.push(`event_loop: ${loopStatus}`);
    lines.push(`memory_heap: ${heapStatus}`);
    lines.push(`cpu_load: ${loadStatus}`);
    lines.push("");
    lines.push(`health_state: ${healthy ? "HEALTHY" : "WARN"}`);
    lines.push("");
    lines.push("metrics:");
    lines.push(`db_ping_ms=${safeMs(dbPingMs)}`);
    lines.push(`event_loop_lag_ms=${safeMs(eventLoopLagMs)}`);
    lines.push(`heap_used=${safeMb(mu.heapUsed)}`);
    lines.push(`rss=${safeMb(mu.rss)}`);
    lines.push(`loadavg_1m=${Number.isFinite(load1) ? load1.toFixed(2) : "—"}`);
    lines.push(`cpus=${cpuCount || "—"}`);
    lines.push(`transport_enforced=${String(enforced)}`);
    lines.push("");
    lines.push("thresholds:");
    lines.push("db_ping <= 300 ms");
    lines.push("event_loop_lag <= 50 ms");
    lines.push("heap_used <= 300 MB");
    lines.push("loadavg_1m <= cpu_count");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_health",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_health",
      result: "diag_health_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleHealthDiag(/diag_health) failed:", e);

    await replyAndLog("⚠️ /diag_health failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_health_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_health_failed",
      cmdBase,
    };
  }
}

export default handleHealthDiag;