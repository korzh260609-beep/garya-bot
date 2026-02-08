// ============================================================================
// src/bot/handlers/projectStatus.js
// Stage 5.1 — Project Status (READ-ONLY FACTS)
// NO AI / NO SIDE EFFECTS
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { getHealthStatus } from "./health.js";

export async function handleProjectStatus({ bot, chatId }) {
  let healthStatus = "unknown";
  let lastSnapshotId = "none";

  // --- health ---
  try {
    const health = await getHealthStatus();
    healthStatus = health?.status ?? "unknown";
  } catch {
    healthStatus = "error";
  }

  // --- repo index snapshot ---
  try {
    const store = new RepoIndexStore({ pool });
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;

    if (repo && branch) {
      const snap = await store.getLatestSnapshot({ repo, branch });
      if (snap && snap.id) {
        lastSnapshotId = snap.id;
      }
    }
  } catch {
    lastSnapshotId = "error";
  }

  await bot.sendMessage(
    chatId,
    [
      "PROJECT STATUS",
      "stage: 6",
      "repo: connected",
      `health: ${healthStatus}`,
      `last_snapshot_id: ${lastSnapshotId}`,
      "project_status: read-only",
    ].join("\n")
  );
}
