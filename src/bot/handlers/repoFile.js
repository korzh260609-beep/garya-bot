// ============================================================================
// === src/bot/handlers/repoFile.js — LEGACY guarded file fetch from RepoIndex snapshot
// ============================================================================
// LEGACY WARNING:
// - This command verifies paths against old repo_index_* snapshots.
// - It is useful only for temporary guarded file browsing.
// - It is NOT the factual current repository map.
// - Factual repo/project state must come from RepoStateAgent.
// ============================================================================

import { RepoSource } from "../../repo/RepoSource.js";
import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function normalizePath(raw) {
  const p = String(raw || "").trim().replace(/^\/+/, "");
  if (!p) return "";
  if (p.includes("..")) return "";
  return p;
}

export async function handleRepoFile(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const path = normalizePath(rest);
  if (!path) {
    await bot.sendMessage(chatId, `Usage: /repo_file <path> — LEGACY snapshot guarded fetch only`);
    return;
  }

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;
  const token = process.env.GITHUB_TOKEN;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(
      chatId,
      [
        `RepoFile: LEGACY snapshot only`,
        `Status: no legacy snapshots yet`,
        `Truth: use RepoStateAgent for factual current repo/project state.`,
      ].join("\n")
    );
    return;
  }

  const existsRes = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [latest.id, path]
  );

  if (!existsRes.rows || existsRes.rows.length === 0) {
    await bot.sendMessage(
      chatId,
      [
        `RepoFile: LEGACY snapshot only`,
        `Status: blocked because path is not in legacy snapshot`,
        `Warning: legacy snapshot may be incomplete.`,
        `Truth: use RepoStateAgent for factual current repo/project state.`,
        `legacySnapshotId: ${latest.id}`,
        `path: ${path}`,
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
        `RepoFile: LEGACY snapshot only`,
        `Status: fetch failed`,
        `Warning: this is not factual current repo/project state.`,
        `Truth: use RepoStateAgent.`,
        `legacySnapshotId: ${latest.id}`,
        `path: ${path}`,
      ].join("\n")
    );
    return;
  }

  const MAX_CHARS = 3500;
  const content =
    item.content.length > MAX_CHARS
      ? item.content.slice(0, MAX_CHARS) + "\n\n...[TRUNCATED]..."
      : item.content;

  await bot.sendMessage(
    chatId,
    [
      `RepoFile: LEGACY snapshot guarded fetch`,
      `Warning: file browsing only; not factual project map.`,
      `Truth: use RepoStateAgent.`,
      `legacySnapshotId: ${latest.id}`,
      `path: ${path}`,
      ``,
      "```",
      content,
      "```",
    ].join("\n")
  );
}