// src/core/diagnostics/watchDiag.js
// STAGE 7B — /diag_watch
// Manual readiness snapshot for future watch mode.
// IMPORTANT:
// - no background loop
// - no timers left running
// - no automatic execution
// - no heavy queries
// - monarch-only, private-only

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

function classifyDbPing(ms) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= 300) return "OK";
  return "WARN";
}

function classifyEventLoopLag(ms) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= 50) return "OK";
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

function calcOverallStatus(parts = []) {
  return parts.every((x) => x === "OK") ? "HEALTHY" : "WARN";
}

export async function handleWatchDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_watch") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_watch доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_watch",
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
      stage: "7B.diag_watch",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const enforced = isTransportEnforced();
    const mu = process.memoryUsage();

    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 0;
    const load1 = Array.isArray(os.loadavg()) ? Number(os.loadavg()[0] || 0) : NaN;
    const heapUsedMb = Math.round((Number(mu.heapUsed || 0) / 1024 / 1024) * 10) / 10;

    const dbStart = process.hrtime.bigint();
    await pool.query(`SELECT 1 AS ok`);
    const dbPingMs = Number(process.hrtime.bigint() - dbStart) / 1e6;

    const loopStart = process.hrtime.bigint();
    const eventLoopLagMs = await new Promise((resolve) => {
      setTimeout(() => {
        const diffMs = Number(process.hrtime.bigint() - loopStart) / 1e6;
        resolve(Math.max(0, diffMs));
      }, 0);
    });

    const transportStatus = enforced ? "OK" : "WARN";
    const dbStatus = classifyDbPing(dbPingMs);
    const loopStatus = classifyEventLoopLag(eventLoopLagMs);
    const heapStatus = classifyHeapUsedMb(heapUsedMb);
    const loadStatus = classifyLoad(load1, cpuCount);

    const overall = calcOverallStatus([
      transportStatus,
      dbStatus,
      loopStatus,
      heapStatus,
      loadStatus,
    ]);

    const lines = [];
    lines.push("👁️ SG WATCH");
    lines.push("");
    lines.push("current_snapshot:");
    lines.push(`transport=${transportStatus}`);
    lines.push(`db_ping=${dbStatus}`);
    lines.push(`event_loop=${loopStatus}`);
    lines.push(`memory_heap=${heapStatus}`);
    lines.push(`cpu_load=${loadStatus}`);
    lines.push(`overall=${overall}`);
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
    lines.push("watch_mode:");
    lines.push("mode=manual_snapshot_only");
    lines.push("background_loop=false");
    lines.push("auto_alerts=false");
    lines.push("runtime_safe=true");
    lines.push("");
    lines.push("future_ready:");
    lines.push("watch_scheduler=NOT_ATTACHED");
    lines.push("alert_dispatch=NOT_ATTACHED");
    lines.push("threshold_config=HARDCODED_STAGE_7B");
    lines.push("status_log_sink=NOT_ATTACHED");
    lines.push("");
    lines.push("next_stage_hint:");
    lines.push("extract thresholds to config");
    lines.push("attach scheduler outside command path");
    lines.push("add warn/critical alert policy");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_watch",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_watch",
      result: "diag_watch_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleWatchDiag(/diag_watch) failed:", e);

    await replyAndLog("⚠️ /diag_watch failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_watch_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_watch_failed",
      cmdBase,
    };
  }
}

export default handleWatchDiag;