// ============================================================================
// src/bot/handlers/projectStatus.js
// Stage 5.1 — Project Status (READ-ONLY FACTS)
// NO AI / NO SIDE EFFECTS
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

export async function handleProjectStatus({ bot, chatId }) {
  let healthStatus = "unknown";
  let lastSnapshotId = "none";

  // --- health (READ-ONLY FACT) ---
  try {
    await pool.query("SELECT 1");
    healthStatus = "ok";
  } catch {
    healthStatus = "fail";
  }

  // --- repo index snapshot (READ-ONLY FACT) ---
  try {
    const store = new RepoIndexStore({ pool });
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;

    if (repo && branch) {
      const snap = await store.getLatestSnapshot({ repo, branch });
      if (snap?.id) {
        lastSnapshotId = String(snap.id);
      }
    }
  } catch {
    lastSnapshotId = "error";
  }

  await bot.sendMessage(
    chatId,
    [
      "PROJECT STATUS",
      "stage: unknown (not auto-evaluated)",
      "repo: connected",
      `health: ${healthStatus}`,
      `last_snapshot_id: ${lastSnapshotId}`,
      "project_status: read-only",
    ].join("\n")
  );
}
