// src/core/diagnostics/diagRetention.js
// STAGE 7B.6 — /diag_retention
// Retention skeleton inspection only.
// IMPORTANT:
// - manual only
// - monarch only
// - private only
// - does NOT delete
// - does NOT archive
// - does NOT attach to runtime

import { getRetentionPolicyState, buildRetentionPlan } from "./retentionPolicy.js";

function safeText(value) {
  if (value == null) return "unlimited";
  return String(value);
}

export async function handleDiagRetention(ctx = {}) {
  const {
    cmdBase,
    isPrivateChat,
    isMonarchUser,
    replyAndLog,
  } = ctx;

  if (cmdBase !== "/diag_retention") {
    return { handled: false };
  }

  if (!isPrivateChat) {
    await replyAndLog("⛔ /diag_retention доступна только в личке.", {
      cmd: cmdBase,
      event: "private_only_block",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_retention",
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
      stage: "7B.diag_retention",
      result: "monarch_only_block",
      cmdBase,
    };
  }

  try {
    const st = getRetentionPolicyState();
    const plan = buildRetentionPlan();

    const lines = [];
    lines.push("🗂️ SG RETENTION");
    lines.push("");
    lines.push("state:");
    lines.push(`enabled=${safeText(st.enabled)}`);
    lines.push(`archive_enabled=${safeText(st.archiveEnabled)}`);
    lines.push(`dry_run_only=${safeText(st.dryRunOnly)}`);
    lines.push(`runtime_attached=${safeText(st.runtimeAttached)}`);
    lines.push(`cleanup_started=${safeText(st.cleanupStarted)}`);
    lines.push(`archive_started=${safeText(st.archiveStarted)}`);
    lines.push("");
    lines.push("policy:");
    lines.push(`guest_retention_days=${safeText(st.guestRetentionDays)}`);
    lines.push(`citizen_retention_days=${safeText(st.citizenRetentionDays)}`);
    lines.push(`monarch_retention_days=${safeText(st.monarchRetentionDays)}`);
    lines.push(`monarch_unlimited=${safeText(st.monarchUnlimited)}`);
    lines.push("");
    lines.push("actions:");
    lines.push(`guest=${safeText(plan?.scopes?.guest?.action)}`);
    lines.push(`citizen=${safeText(plan?.scopes?.citizen?.action)}`);
    lines.push(`monarch=${safeText(plan?.scopes?.monarch?.action)}`);
    lines.push("");
    lines.push("mode:");
    lines.push("skeleton_only=true");
    lines.push("delete_enabled=false");
    lines.push("archive_move_enabled=false");

    await replyAndLog(lines.join("\n").slice(0, 3900), {
      cmd: cmdBase,
      event: "diag_retention",
    });

    return {
      handled: true,
      ok: true,
      stage: "7B.diag_retention",
      result: "diag_retention_replied",
      cmdBase,
    };
  } catch (e) {
    console.error("handleDiagRetention(/diag_retention) failed:", e);

    await replyAndLog("⚠️ /diag_retention failed. Проверь Render logs.", {
      cmd: cmdBase,
      event: "diag_retention_failed",
    });

    return {
      handled: true,
      ok: false,
      reason: "diag_retention_failed",
      cmdBase,
    };
  }
}

export default handleDiagRetention;