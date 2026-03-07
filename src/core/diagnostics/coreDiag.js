// src/core/diagnostics/coreDiag.js
// STAGE 7B — /diag_core
// Safe core/runtime diagnostic for enforced transport path.

import os from "os";
import process from "process";

// ⚠️ ВАЖНО: правильный путь
import { isTransportEnforced } from "../../transport/transportConfig.js";

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

export async function handleCoreDiag(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    globalUserId,
    chatIdStr,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_core") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_core доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_core",
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
      stage: "7B.diag_core",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const mu = process.memoryUsage();

    const lines = [];

    lines.push("🧠 CORE DIAG");
    lines.push("");

    lines.push(`chat_id: ${chatIdStr || "—"}`);
    lines.push(`global_user_id: ${globalUserId || "—"}`);

    lines.push("");
    lines.push("runtime:");

    lines.push(`node: ${process.version}`);
    lines.push(`pid: ${process.pid}`);
    lines.push(`platform: ${process.platform}`);
    lines.push(`arch: ${process.arch}`);

    lines.push(`uptime: ${formatUptime(process.uptime())}`);
    lines.push(`host_uptime: ${formatUptime(os.uptime())}`);

    lines.push("");
    lines.push("memory:");

    lines.push(`rss=${safeMb(mu.rss)}`);
    lines.push(`heap_total=${safeMb(mu.heapTotal)}`);
    lines.push(`heap_used=${safeMb(mu.heapUsed)}`);
    lines.push(`external=${safeMb(mu.external)}`);
    lines.push(`array_buffers=${safeMb(mu.arrayBuffers)}`);

    lines.push("");
    lines.push("flags:");

    lines.push(`node_env: ${process.env.NODE_ENV || "—"}`);
    lines.push(`transport_enforced: ${String(isTransportEnforced())}`);
    lines.push(`stage_hint: 7B`);

    lines.push("");
    lines.push("cpu:");

    lines.push(`loadavg=${os.loadavg().map((x) => x.toFixed(2)).join(", ")}`);
    lines.push(`cpus=${Array.isArray(os.cpus()) ? os.cpus().length : "—"}`);

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_core",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_core",
      result: "diag_core_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleCoreDiag(/diag_core) failed:", e);

    await replyAndLog("⚠️ /diag_core failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_core_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_core_failed",
      cmdBase,
    };
  }
}

export default handleCoreDiag;