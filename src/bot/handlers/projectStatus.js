// ============================================================================
// src/bot/handlers/projectStatus.js
// Stage 6.1 — Project Status (READ-ONLY FACTS)
// NO AI / NO SIDE EFFECTS
// ============================================================================

import { getLastSnapshotId } from "../../repo/RepoIndex.js";
import { getHealthStatus } from "./health.js";

export async function handleProjectStatus({ bot, chatId }) {
  let snapshotId = "unknown";
  let healthStatus = "unknown";

  try {
    snapshotId = await getLastSnapshotId();
  } catch (e) {
    snapshotId = "error";
  }

  try {
    const health = await getHealthStatus();
    healthStatus = health?.status ?? "unknown";
  } catch (e) {
    healthStatus = "error";
  }

  await bot.sendMessage(
    chatId,
    [
      "PROJECT STATUS",
      "stage: 6",
      "repo: connected",
      `health: ${healthStatus}`,
      `last_snapshot_id: ${snapshotId}`,
      "project_status: read-only",
    ].join("\n")
  );
}
