// ============================================================================
// === src/bot/handlers/repoSearch.js — search paths in snapshot (READ-ONLY)
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

function normalizeQuery(raw) {
  let q = String(raw || "").trim();
  if (!q) return "";
  // strip outer quotes: "run" -> run, 'run' -> run
  if ((q.startsWith('"') && q.endsWith('"')) || (q.startsWith("'") && q.endsWith("'"))) {
    q = q.slice(1, -1).trim();
  }
  if (!q) return "";
  if (q.length < 2) return ""; // слишком шумно
  return q;
}

export async function handleRepoSearch({ bot, chatId, rest }) {
  const ok = await requireMonarch(bot, chatId);
  if (!ok) return;

  const q = normalizeQuery(rest);
  if (!q) {
    await bot.sendMessage(chatId, "Usage: /repo_search <pattern> (min 2 chars)");
    return;
  }

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, "RepoSearch: no snapshots yet (run /reindex first)");
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
        `RepoSearch: none`,
        `snapshotId: ${latest.id}`,
        `query: ${q}`,
      ].join("\n")
    );
    return;
  }

  const lines = rows.map((r) => `- ${r.path}`);

  await bot.sendMessage(
    chatId,
    [
      `RepoSearch: ok`,
      `snapshotId: ${latest.id}`,
      `query: ${q}`,
      `matches: ${rows.length} (showing up to 60)`,
      ``,
      ...lines,
    ].join("\n")
  );
}

