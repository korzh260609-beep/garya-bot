// ============================================================================
// === src/bot/handlers/repoTree.js — show repo tree from PostgreSQL snapshot
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

export async function handleRepoTree({ bot, chatId, senderIdStr, rest }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });

  const latest = await store.getLatestSnapshot({ repo, branch });
  if (!latest) {
    await bot.sendMessage(chatId, `RepoTree: no snapshots yet`);
    return;
  }

  const prefixRaw = (rest || "").trim();
  const prefix = prefixRaw
    ? prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`
    : "";

  const rows = await store.getTree({ snapshotId: latest.id, prefix });

  if (!rows || rows.length === 0) {
    await bot.sendMessage(
      chatId,
      [
        `RepoTree: empty`,
        `snapshotId: ${latest.id}`,
        `prefix: ${prefix || "(root)"}`,
      ].join("\n")
    );
    return;
  }

  const MAX_LINES = 60;
  const lines = rows.slice(0, MAX_LINES).map((r) => `- ${r.path}`);

  await bot.sendMessage(
    chatId,
    [
      `RepoTree: ok`,
      `snapshotId: ${latest.id}`,
      `prefix: ${prefix || "(root)"}`,
      `files: ${rows.length}`,
      `showing: ${Math.min(rows.length, MAX_LINES)}`,
      ``,
      ...lines,
      rows.length > MAX_LINES ? `\n…(+${rows.length - MAX_LINES} more)` : ``,
    ].join("\n")
  );
}
