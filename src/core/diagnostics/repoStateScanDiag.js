// src/core/diagnostics/repoStateScanDiag.js
// ============================================================================
// Repo State Scan Diagnostic
// Manual monarch-only trigger for Repo State Collector.
// ============================================================================

import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";

function yesNo(value) {
  return value ? "yes" : "no";
}

export async function handleRepoStateScanDiag(ctx = {}) {
  const isMonarchUser = ctx?.isMonarchUser === true;

  if (!isMonarchUser) {
    if (typeof ctx?.replyAndLog === "function") {
      await ctx.replyAndLog("⛔ Repo State scan доступен только монарху.", {
        cmd: "/repo_state_scan",
        event: "repo_state_scan_forbidden",
      });
    }

    return {
      handled: true,
      ok: false,
      reason: "monarch_only",
    };
  }

  const { collector, config } = createRepoStateCollector();

  if (!config.enabled) {
    const text = [
      "⚠️ Repo State Collector выключен.",
      "",
      "Нужно ENV:",
      "REPO_STATE_COLLECTOR_ENABLED=true",
    ].join("\n");

    if (typeof ctx?.replyAndLog === "function") {
      await ctx.replyAndLog(text, {
        cmd: "/repo_state_scan",
        event: "repo_state_scan_disabled",
      });
    }

    return {
      handled: true,
      ok: false,
      reason: "repo_state_collector_disabled",
    };
  }

  const snapshot = await collector.runScan();

  const text = [
    "🧭 Repo State scan complete",
    "",
    `ok: ${yesNo(snapshot?.ok)}`,
    `persisted: ${yesNo(snapshot?.persisted)}`,
    `repo: ${snapshot?.repoFullName || config.repoFullName || "-"}`,
    `branch: ${snapshot?.branch || config.branch || "-"}`,
    "",
    `files: ${snapshot?.filesCount ?? "-"}`,
    `modules: ${snapshot?.modulesCount ?? "-"}`,
    `dependencies: ${snapshot?.dependenciesCount ?? "-"}`,
    "",
    `contentLoaded: ${snapshot?.tree?.contentFilesLoaded ?? "-"}`,
    `contentSkipped: ${snapshot?.tree?.contentFilesSkipped ?? "-"}`,
    `structureComplete: ${yesNo(snapshot?.tree?.structureComplete)}`,
    `hiddenFiles: ${snapshot?.tree?.hiddenFilesCount ?? "-"}`,
    "",
    `scanRunId: ${snapshot?.persistence?.scanRunId || "-"}`,
    `error: ${snapshot?.error || snapshot?.persistence?.error || "-"}`,
  ].join("\n");

  if (typeof ctx?.replyAndLog === "function") {
    await ctx.replyAndLog(text, {
      cmd: "/repo_state_scan",
      event: "repo_state_scan_complete",
      ok: snapshot?.ok === true,
      persisted: snapshot?.persisted === true,
      scan_run_id: snapshot?.persistence?.scanRunId || null,
    });
  }

  return {
    handled: true,
    ok: snapshot?.ok === true && snapshot?.persisted === true,
    snapshot: {
      ok: snapshot?.ok === true,
      persisted: snapshot?.persisted === true,
      filesCount: snapshot?.filesCount || 0,
      modulesCount: snapshot?.modulesCount || 0,
      dependenciesCount: snapshot?.dependenciesCount || 0,
      scanRunId: snapshot?.persistence?.scanRunId || null,
    },
  };
}

export default handleRepoStateScanDiag;
