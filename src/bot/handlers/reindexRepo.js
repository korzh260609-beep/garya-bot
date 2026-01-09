// ============================================================================
// === src/bot/handlers/reindexRepo.js — DRY-RUN trigger (normal output)
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
  const filesCount = Array.isArray(snapshot?.files) ? snapshot.files.length : 0;

  await bot.sendMessage(
    chatId,
    [
      `RepoIndex: dry-run`,
      `filesListed: ${stats.filesListed ?? "?"}`,
      `filesFetched: ${stats.filesFetched ?? "?"}`,
      `filesSkipped: ${stats.filesSkipped ?? "?"}`,
      `snapshotFiles: ${filesCount}`,
    ].join("\n")
  );
}
