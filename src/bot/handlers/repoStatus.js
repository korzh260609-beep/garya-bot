// ============================================================================
// === src/bot/handlers/repoStatus.js — show latest repo snapshot from PostgreSQL
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";

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

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "garya-bot",
      },
    });

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
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, `RepoStatus: no snapshots yet`);
    return;
  }

  // files count
  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
    [latest.id]
  );
  const filesCount = countRes?.rows?.[0]?.cnt ?? 0;

  // -----------------------------------------------------------------------
  // Fix display: commitSha is NULL in DB → try to fetch and persist once
  // -----------------------------------------------------------------------
  let commitSha = latest.commit_sha || null;

  if (!commitSha) {
    const headSha = await fetchHeadCommitSha({ repo, branch });

    if (headSha) {
      commitSha = headSha;

      // Persist into repo_index_snapshots for this snapshot (safe, non-breaking)
      try {
        await pool.query(
          `
          UPDATE repo_index_snapshots
          SET commit_sha = $2
          WHERE id = $1
        `,
          [latest.id, headSha]
        );
      } catch {
        // ignore — we still can show headSha
      }
    }
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
