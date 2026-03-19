// ============================================================================
// === src/bot/handlers/repoStatus.js — show latest repo snapshot from PostgreSQL
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { fetchWithTimeout } from "../../core/fetchWithTimeout.js";

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

// ---------------------------------------------------------------------------
// Fallback: fetch HEAD commit SHA for (repo, branch) from GitHub API
// - Uses GITHUB_TOKEN if present
// - Does NOT throw (safe)
// ---------------------------------------------------------------------------
// TEMP DEBUG:
// function kept for future restore, but NOT used in current test version
async function fetchHeadCommitSha({ repo, branch }) {
  try {
    const token = String(process.env.GITHUB_TOKEN || "").trim();
    if (!token) return null;

    const repoStr = String(repo || "").trim();
    const branchStr = String(branch || "").trim();
    if (!repoStr || !branchStr) return null;

    // repo format expected: "owner/name"
    const url = `https://api.github.com/repos/${repoStr}/commits/${encodeURIComponent(
      branchStr
    )}`;

    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "garya-bot",
        },
      },
      5000
    );

    if (!res.ok) return null;

    const data = await res.json();
    const sha = data?.sha ? String(data.sha) : null;
    if (!sha) return null;

    return sha;
  } catch {
    return null;
  }
}

export async function handleRepoStatus({ bot, chatId, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });

  let latest;
  let filesCount = 0;

  try {
    latest = await store.getLatestSnapshot({ repo, branch });

    if (!latest) {
      await bot.sendMessage(chatId, `RepoStatus: no snapshots yet`);
      return;
    }

    // files count
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
      [latest.id]
    );
    filesCount = countRes?.rows?.[0]?.cnt ?? 0;
  } catch (e) {
    const msg = String(e?.message || e || "");

    if (
      msg.includes('relation "repo_index_snapshots" does not exist') ||
      msg.includes("repo_index_snapshots")
    ) {
      await bot.sendMessage(
        chatId,
        "RepoStatus: таблица не инициализирована, запусти /reindex сначала"
      );
      return;
    }

    if (
      msg.includes('relation "repo_index_files" does not exist') ||
      msg.includes("repo_index_files")
    ) {
      await bot.sendMessage(
        chatId,
        "RepoStatus: файловый индекс не инициализирован, запусти /reindex сначала"
      );
      return;
    }

    await bot.sendMessage(chatId, "RepoStatus: DB error while reading snapshot");
    return;
  }

  // -----------------------------------------------------------------------
  // TEMP DEBUG:
  // Skip GitHub fetchHeadCommitSha() completely to verify whether repo_status
  // hangs on external fetch without timeout.
  // -----------------------------------------------------------------------
  let commitSha = latest.commit_sha || null;

  if (!commitSha) {
    commitSha = "null";
  }

  await bot.sendMessage(
    chatId,
    [
      `RepoStatus: ok`,
      `snapshotId: ${latest.id}`,
      `repo: ${latest.repo || "?"}`,
      `branch: ${latest.branch || "?"}`,
      `commitSha: ${commitSha || "null"}`,
      `createdAt: ${latest.created_at || "?"}`,
      `filesCount: ${filesCount}`,
    ].join("\n")
  );
}