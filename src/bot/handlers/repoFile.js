// ============================================================================
// === src/bot/handlers/repoFile.js — fetch file ONLY if it exists in snapshot
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
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

function normalizePath(raw) {
  const p = String(raw || "").trim().replace(/^\/+/, "");
  if (!p) return "";
  // block traversal
  if (p.includes("..")) return "";
  return p;
}

export async function handleRepoFile({ bot, chatId, rest }) {
  const ok = await requireMonarch(bot, chatId);
  if (!ok) return;

  const path = normalizePath(rest);
  if (!path) {
    await bot.sendMessage(chatId, `Usage: /repo_file <path>`);
    return;
  }

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;
  const token = process.env.GITHUB_TOKEN;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, `RepoFile: no snapshots yet (run /reindex first)`);
    return;
  }

  // Verify path exists in snapshot (security + correctness)
  const existsRes = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [latest.id, path]
  );

  if (!existsRes.rows || existsRes.rows.length === 0) {
    await bot.sendMessage(
      chatId,
      [
        `RepoFile: blocked (path not in snapshot)`,
        `snapshotId: ${latest.id}`,
        `path: ${path}`,
        `Tip: use /repo_tree or reindex`,
      ].join("\n")
    );
    return;
  }

  const source = new RepoSource({ repo, branch, token });

  const item = await source.fetchTextFile(path);
  if (!item || typeof item.content !== "string") {
    await bot.sendMessage(
      chatId,
      [
        `RepoFile: fetch failed`,
        `snapshotId: ${latest.id}`,
        `path: ${path}`,
      ].join("\n")
    );
    return;
  }

  // Telegram message size guard
  const MAX_CHARS = 3500;
  const content = item.content.length > MAX_CHARS
    ? item.content.slice(0, MAX_CHARS) + "\n\n...[TRUNCATED]..."
    : item.content;

  await bot.sendMessage(
    chatId,
    [
      `RepoFile: ok`,
      `snapshotId: ${latest.id}`,
      `path: ${path}`,
      ``,
      "```",
      content,
      "```",
    ].join("\n")
  );
}

