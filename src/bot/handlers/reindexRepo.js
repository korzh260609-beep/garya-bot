// ============================================================================
// === src/bot/handlers/reindexRepo.js — DRY-RUN trigger (summary output)
// ============================================================================

import { RepoIndexService } from "../../repo/RepoIndexService.js";

export async function handleReindexRepo({ bot, chatId }) {
  const service = new RepoIndexService({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const snapshot = await service.runIndex();

  const summary = snapshot.getSummary
    ? snapshot.getSummary()
    : {
        repo: snapshot?.repo,
        branch: snapshot?.branch,
        createdAt: snapshot?.createdAt,
        stats: snapshot?.stats,
        snapshotFiles: Array.isArray(snapshot?.files) ? snapshot.files.length : 0,
        memoryCandidates: 0,
      };

  await bot.sendMessage(
    chatId,
    [
      `RepoIndex: dry-run`,
      `repo: ${summary.repo || "?"}`,
      `branch: ${summary.branch || "?"}`,
      `createdAt: ${summary.createdAt || "?"}`,
      `filesListed: ${summary.stats?.filesListed ?? "?"}`,
      `filesFetched: ${summary.stats?.filesFetched ?? "?"}`,
      `filesSkipped: ${summary.stats?.filesSkipped ?? "?"}`,
      `snapshotFiles: ${summary.snapshotFiles ?? "?"}`,
      `memoryCandidates: ${summary.memoryCandidates ?? "?"}`,
    ].join("\n")
  );
}
