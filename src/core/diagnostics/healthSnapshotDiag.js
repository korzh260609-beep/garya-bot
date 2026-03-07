// src/core/diagnostics/healthSnapshotDiag.js
// STAGE 7B — /diag_health_snapshot
// Manual snapshot via takeHealthSnapshot()
// IMPORTANT:
// - manual only
// - monarch only
// - private only
// - does NOT start scheduler
// - does NOT attach to runtime

import { takeHealthSnapshot } from "./healthScheduler.js";

function safeText(value) {
  if (value == null) return "—";
  return String(value);
}

export async function handleHealthSnapshotDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_health_snapshot") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_health_snapshot доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_health_snapshot",
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
      stage: "7B.diag_health_snapshot",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const snapshot = await takeHealthSnapshot();

    const lines = [];
    lines.push("❤️ SG HEALTH SNAPSHOT");
    lines.push("");
    lines.push(`ts=${safeText(snapshot.ts)}`);
    lines.push("");
    lines.push(`transport=${safeText(snapshot.transportStatus)}`);
    lines.push(`db=${safeText(snapshot.dbStatus)}`);
    lines.push(`event_loop=${safeText(snapshot.loopStatus)}`);
    lines.push(`heap=${safeText(snapshot.heapStatus)}`);
    lines.push(`load=${safeText(snapshot.loadStatus)}`);
    lines.push("");
    lines.push(`overall=${safeText(snapshot.overall)}`);
    lines.push(`severity=${safeText(snapshot.severity)}`);
    lines.push("");
    lines.push("metrics:");
    lines.push(`db_ping_ms=${safeText(snapshot?.metrics?.dbPingMs)}`);
    lines.push(`event_loop_lag_ms=${safeText(snapshot?.metrics?.eventLoopLagMs)}`);
    lines.push(`heap_used_mb=${safeText(snapshot?.metrics?.heapUsedMb)}`);
    lines.push(`rss_mb=${safeText(snapshot?.metrics?.rssMb)}`);
    lines.push(`loadavg1m=${safeText(snapshot?.metrics?.loadavg1m)}`);
    lines.push(`cpus=${safeText(snapshot?.metrics?.cpus)}`);
    lines.push("");
    lines.push("mode:");
    lines.push("manual_snapshot_only=true");
    lines.push("scheduler_started=false");
    lines.push("runtime_attached=false");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_health_snapshot",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_health_snapshot",
      result: "diag_health_snapshot_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleHealthSnapshotDiag(/diag_health_snapshot) failed:", e);

    await replyAndLog("⚠️ /diag_health_snapshot failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_health_snapshot_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_health_snapshot_failed",
      cmdBase,
    };
  }
}

export default handleHealthSnapshotDiag;