// ============================================================================
// === src/bot/handlers/reindexRepo.js — DRY-RUN + Postgres snapshot persist
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexService } from "../../repo/RepoIndexService.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

function formatCandidatesPreview(preview, limit = 10) {
  if (!preview || !Array.isArray(preview.items) || preview.items.length === 0) {
    return [`memoryCandidatesPreview: none`].join("\n");
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

// ---------------------------------------------------------------------------
// Permission guard (monarch-only) — Stage 4: identity-first (MONARCH_USER_ID)
// ---------------------------------------------------------------------------
async function requireMonarch(bot, chatId, userIdStr) {
  const MONARCH_USER_ID = String(process.env.MONARCH_USER_ID || "").trim();
  if (!MONARCH_USER_ID) return true;

  if (String(userIdStr) !== MONARCH_USER_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }
  return true;
}

export async function handleReindexRepo({ bot, chatId, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  // === Store (PostgreSQL) ===
  const store = new RepoIndexStore({ pool });

  // === Service ===
  const service = new RepoIndexService({
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH,
    token: process.env.GITHUB_TOKEN,
    store,
  });

  // === Run index ===
  const { snapshot, persisted } = await service.runIndex();

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

  const fullTreePersistedFiles =
    typeof persisted?.filesCount === "number" ? persisted.filesCount : "?";

  await bot.sendMessage(
    chatId,
    [
      `RepoIndex: ${persisted?.snapshotId ? "persisted" : "dry-run"}`,
      persisted?.snapshotId ? `snapshotId: ${persisted.snapshotId}` : `snapshotId: none`,
      `repo: ${summary.repo || "?"}`,
      `branch: ${summary.branch || "?"}`,
      `createdAt: ${summary.createdAt || "?"}`,

      // Contour A: full tree (persisted)
      `fullTreePersistedFiles: ${fullTreePersistedFiles}`,

      // Contour B: content index (allowlist)
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
