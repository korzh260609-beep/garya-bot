// ============================================================================
// === src/bot/handlers/reindexRepo.js — SKELETON (Repo Index trigger)
// ============================================================================

import { RepoIndexService } from "../../repo/RepoIndexService.js";

export async function handleReindexRepo({ bot, chatId }) {
  const service = new RepoIndexService({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
  });

  const result = await service.runIndex();

  await bot.sendMessage(
    chatId,
    `RepoIndex: ${result.status}. Files indexed: ${result.filesIndexed}`
  );
}
