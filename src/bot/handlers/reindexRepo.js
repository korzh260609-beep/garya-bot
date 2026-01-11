// ============================================================================
// === src/bot/handlers/reindexRepo.js — DRY-RUN trigger (summary + preview)
// ============================================================================

import { RepoIndexService } from "../../repo/RepoIndexService.js";

function formatCandidatesPreview(preview, limit = 10) {
  if (!preview || !Array.isArray(preview.items) || preview.items.length === 0) {
    return [
      `memoryCandidatesPreview: none`,
    ].join("\n");
  }

  const items = preview.items.slice(0, Math.max(0, Number(limit) || 0));

  const lines = [];
  lines.push(`memoryCandidatesPreview:`);
  lines.push(`- totalAllowed: ${preview.candidatesTotal ?? "?"}`);
  lines.push(`- previewCount: ${preview.previewCount ?? items.length ?? "?"}`);

  if (preview.byType && typeof preview.byType === "object") {
    lines.push(`- byType: ${JSON.stringify(preview.byType)}`);
  }
  if (preview.bySensitivity && typeof preview.bySensitivity === "object") {
    lines.push(`- bySensitivity: ${JSON.stringify(preview.bySensitivity)}`);
  }

  lines.push(`- items(top ${items.length}):`);

  for (let i = 0; i < items.length; i += 1) {
    const c = items[i];
    lines.push(
      [
        `  ${i + 1}) ${c.title || "?"}`,
        `     id: ${(c.candidate_id || "?").slice(0, 16)}…`,
        `     type: ${c.type || "?"} | sensitivity: ${c.sensitivity || "?"}`,
        `     source: ${c.source || "?"}`,
        `     why: ${c.why || "?"}`,
      ].join("\n")
    );
  }

  return lines.join("\n");
}

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
        memoryCandidatesPreview: null,
      };

  const previewBlock = formatCandidatesPreview(summary.memoryCandidatesPreview, 10);

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
      ``,
      previewBlock,
    ].join("\n")
  );
}
