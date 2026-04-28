// ============================================================================
// === src/bot/handlers/repoTree.js — LEGACY tree browsing from RepoIndex snapshot
// ============================================================================
// LEGACY WARNING:
// - This command reads old repo_index_* snapshots only.
// - It is useful only for temporary file browsing.
// - It is NOT the factual current repository map.
// - Factual repo/project state must come from RepoStateAgent.
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

export async function handleRepoTree(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });

  const latest = await store.getLatestSnapshot({ repo, branch });
  if (!latest) {
    await bot.sendMessage(
      chatId,
      [
        `RepoTree: LEGACY snapshot only`,
        `Status: no legacy snapshots yet`,
        `Truth: use RepoStateAgent for factual current repo/project state.`,
      ].join("\n")
    );
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
        `RepoTree: LEGACY snapshot only`,
        `Status: empty`,
        `Warning: this is not factual current repo/project state.`,
        `Truth: use RepoStateAgent.`,
        `legacySnapshotId: ${latest.id}`,
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
      `RepoTree: LEGACY snapshot only`,
      `Warning: file browsing only; not factual project map.`,
      `Truth: use RepoStateAgent.`,
      ``,
      `legacySnapshotId: ${latest.id}`,
      `prefix: ${prefix || "(root)"}`,
      `legacyFiles: ${rows.length}`,
      `showing: ${Math.min(rows.length, MAX_LINES)}`,
      ``,
      ...lines,
      rows.length > MAX_LINES ? `\n…(+${rows.length - MAX_LINES} more)` : ``,
    ].join("\n")
  );
}