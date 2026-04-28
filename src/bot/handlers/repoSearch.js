// ============================================================================
// === src/bot/handlers/repoSearch.js — LEGACY path search in RepoIndex snapshot
// ============================================================================
// LEGACY WARNING:
// - This command searches old repo_index_* snapshots only.
// - It is useful only for temporary file/path browsing.
// - It is NOT the factual current repository map.
// - Factual repo/project state must come from RepoStateAgent.
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function normalizeQuery(raw) {
  let q = String(raw || "").trim();
  if (!q) return "";
  if ((q.startsWith('"') && q.endsWith('"')) || (q.startsWith("'") && q.endsWith("'"))) {
    q = q.slice(1, -1).trim();
  }
  if (!q) return "";
  if (q.length < 2) return "";
  return q;
}

export async function handleRepoSearch(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const q = normalizeQuery(rest);
  if (!q) {
    await bot.sendMessage(chatId, "Usage: /repo_search <pattern> (min 2 chars) — LEGACY snapshot search only");
    return;
  }

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(
      chatId,
      [
        "RepoSearch: LEGACY snapshot only",
        "Status: no legacy snapshots yet",
        "Truth: use RepoStateAgent for factual current repo/project state.",
      ].join("\n")
    );
    return;
  }

  const like = `%${q}%`;

  const res = await pool.query(
    `
      SELECT path
      FROM repo_index_files
      WHERE snapshot_id = $1
        AND path ILIKE $2
      ORDER BY path ASC
      LIMIT 60
    `,
    [latest.id, like]
  );

  const rows = res?.rows || [];
  if (rows.length === 0) {
    await bot.sendMessage(
      chatId,
      [
        `RepoSearch: LEGACY snapshot only`,
        `Status: none`,
        `Warning: this is not factual current repo/project state.`,
        `Truth: use RepoStateAgent.`,
        `legacySnapshotId: ${latest.id}`,
        `query: ${q}`,
      ].join("\n")
    );
    return;
  }

  const lines = rows.map((r) => `- ${r.path}`);

  await bot.sendMessage(
    chatId,
    [
      `RepoSearch: LEGACY snapshot only`,
      `Warning: path browsing only; not factual project map.`,
      `Truth: use RepoStateAgent.`,
      ``,
      `legacySnapshotId: ${latest.id}`,
      `query: ${q}`,
      `legacyMatches: ${rows.length} (showing up to 60)`,
      ``,
      ...lines,
    ].join("\n")
  );
}