// ============================================================================
// === src/bot/handlers/reindexRepo.js — DRY-RUN trigger (Snapshot diagnostics)
// ============================================================================

import { RepoIndexService } from "../../repo/RepoIndexService.js";

export async function handleReindexRepo({ bot, chatId }) {
  const service = new RepoIndexService({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const snapshot = await service.runIndex();

  const stats = snapshot?.stats || {};
  const files = Array.isArray(snapshot?.files) ? snapshot.files : [];
  const pillarsCount = files.filter((f) => f?.path?.startsWith("pillars/")).length;
  const firstPaths = files.slice(0, 10).map((f) => f.path).join("\n");

  await bot.sendMessage(
    chatId,
    [
      `RepoIndex: dry-run`,
      `filesListed: ${stats.filesListed ?? "?"}`,
      `filesFetched: ${stats.filesFetched ?? "?"}`,
      `filesSkipped: ${stats.filesSkipped ?? "?"}`,
      `snapshotFiles: ${files.length}`,
      `pillarsInSnapshot: ${pillarsCount}`,
      `first10:\n${firstPaths}`,
    ].join("\n")
  );
}
