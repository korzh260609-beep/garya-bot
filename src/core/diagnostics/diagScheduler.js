// src/core/diagnostics/diagScheduler.js
// STAGE 7B — /diag_scheduler
// Scheduler skeleton inspection only.
// IMPORTANT:
// - manual only
// - monarch only
// - private only
// - does NOT start scheduler
// - does NOT attach to runtime
// - safe inspection only

import { getHealthSchedulerConfig } from "./healthConfig.js";

function safeText(value) {
  if (value == null) return "—";
  return String(value);
}

function safeJsonLine(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "—";
  }
}

export async function handleDiagScheduler(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_scheduler") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_scheduler доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_scheduler",
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
      stage: "7B.diag_scheduler",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const config = getHealthSchedulerConfig();
    const st = {
      enabled: Boolean(config.ENABLED),
      running: false,
      intervalMs: config.INTERVAL_MS,
      warnConsecutiveCount: config.WARN_CONSECUTIVE_COUNT,
      criticalConsecutiveCount: config.CRITICAL_CONSECUTIVE_COUNT,
      warnStreak: 0,
      criticalStreak: 0,
      lastSnapshot: null,
    };

    const lines = [];
    lines.push("🧭 SG SCHEDULER");
    lines.push("");
    lines.push("scheduler:");
    lines.push(`enabled=${safeText(st.enabled)}`);
    lines.push(`running=${safeText(st.running)}`);
    lines.push(`interval_ms=${safeText(st.intervalMs)}`);
    lines.push(`warn_consecutive_count=${safeText(st.warnConsecutiveCount)}`);
    lines.push(`critical_consecutive_count=${safeText(st.criticalConsecutiveCount)}`);
    lines.push(`warn_streak=${safeText(st.warnStreak)}`);
    lines.push(`critical_streak=${safeText(st.criticalStreak)}`);
    lines.push("");
    lines.push("last_snapshot:");
    if (!st.lastSnapshot) {
      lines.push("—");
    } else {
      lines.push(`ts=${safeText(st.lastSnapshot.ts)}`);
      lines.push(`overall=${safeText(st.lastSnapshot.overall)}`);
      lines.push(`severity=${safeText(st.lastSnapshot.severity)}`);
      lines.push(`metrics=${safeJsonLine(st.lastSnapshot.metrics)}`);
    }
    lines.push("");
    lines.push("mode:");
    lines.push("inspection_only=true");
    lines.push("auto_start=false");
    lines.push("runtime_attached=false");
    lines.push("");
    lines.push("stage_hint:");
    lines.push("scheduler skeleton exists but is not attached");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_scheduler",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_scheduler",
      result: "diag_scheduler_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleDiagScheduler(/diag_scheduler) failed:", e);

    await replyAndLog("⚠️ /diag_scheduler failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_scheduler_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_scheduler_failed",
      cmdBase,
    };
  }
}

export default handleDiagScheduler;