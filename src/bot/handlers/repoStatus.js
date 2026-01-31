// ============================================================================
// === src/bot/handlers/repoStatus.js — show latest repo snapshot from PostgreSQL
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

// ---------------------------------------------------------------------------
// Permission guard (monarch-only)
// ---------------------------------------------------------------------------
async function requireMonarch(bot, chatId) {
  const MONARCH_CHAT_ID = String(process.env.MONARCH_CHAT_ID || "").trim();
  if (!MONARCH_CHAT_ID) return true;

  if (String(chatId) !== MONARCH_CHAT_ID) {
    await bot.sendMessage(chatId, "⛔ Недостаточно прав (monarch-only).");
    return false;
  }
  return true;
}

export async function handleRepoStatus({ bot, chatId }) {
  const ok = await requireMonarch(bot, chatId);
  if (!ok) return;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });

  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, `RepoStatus: no snapshots yet`);
    return;
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
    [latest.id]
  );

  const filesCount = countRes?.rows?.[0]?.cnt ?? 0;

  await bot.sendMessage(
    chatId,
    [
      `RepoStatus: ok`,
      `snapshotId: ${latest.id}`,
      `repo: ${latest.repo || "?"}`,
      `branch: ${latest.branch || "?"}`,
      `commitSha: ${latest.commit_sha || "null"}`,
      `createdAt: ${latest.created_at || "?"}`,
      `filesCount: ${filesCount}`,
    ].join("\n")
  );
}

