// ============================================================================
// === src/bot/handlers/repoReview2.js — LEGACY repo snapshot review
// === READ-ONLY, no GitHub fetch
// ============================================================================
// LEGACY WARNING:
// - This command reviews old repo_index_* snapshots only.
// - It is NOT the factual current repository state.
// - It is NOT the factual architecture health source.
// - Factual repo/project state must come from RepoStateAgent.
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { requireMonarchPrivateAccess } from "./handlerAccess.js";

function dirOf(path) {
  const p = String(path || "");
  const i = p.lastIndexOf("/");
  return i === -1 ? "(root)" : p.slice(0, i);
}

function topN(obj, n = 8) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function isSuspicious(path) {
  const lower = String(path || "").toLowerCase();

  const bad = [
    ".env",
    "secret",
    "token",
    "apikey",
    "api_key",
    "private",
    "credential",
    "passwd",
    "password",
    "keys",
    "cert",
    "pem",
    "id_rsa",
  ];

  if (bad.some((x) => lower.includes(x))) return true;
  return false;
}

export async function handleRepoReview2(ctx = {}) {
  const ok = await requireMonarchPrivateAccess(ctx);
  if (!ok) return;

  const { bot, chatId } = ctx;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(
      chatId,
      [
        "RepoReview2: LEGACY snapshot only",
        "Status: no legacy snapshots yet",
        "Truth: use RepoStateAgent for factual current repo/project state.",
      ].join("\n")
    );
    return;
  }

  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
    [latest.id]
  );

  const paths = (res.rows || []).map((r) => r.path).filter(Boolean);

  const filesCount = paths.length;

  const byDir = {};
  for (const p of paths) {
    const d = dirOf(p);
    byDir[d] = (byDir[d] || 0) + 1;
  }

  const requiredPillars = [
    "pillars/CODE_INSERT_RULES.md",
    "pillars/DECISIONS.md",
    "pillars/KINGDOM.md",
    "pillars/PROJECT.md",
    "pillars/REPOINDEX.md",
    "pillars/ROADMAP.md",
    "pillars/SG_BEHAVIOR.md",
    "pillars/SG_ENTITY.md",
    "pillars/WORKFLOW.md",
  ];

  const present = new Set(paths);
  const missingPillars = requiredPillars.filter((p) => !present.has(p));

  const suspicious = paths.filter(isSuspicious);

  const expectedKeyFiles = [
    "db.js",
    "index.js",
    "modelConfig.js",
    "src/repo/RepoIndexService.js",
    "src/repo/RepoIndexSnapshot.js",
    "src/repo/RepoSource.js",
    "src/repo/githubApi.js",
    "src/bot/messageRouter.js",
    "src/bot/handlers/reindexRepo.js",
    "src/bot/handlers/repoStatus.js",
    "src/bot/handlers/repoTree.js",
    "src/bot/handlers/repoFile.js",
    "src/bot/handlers/repoAnalyze.js",
    "src/bot/handlers/repoSearch.js",
  ];

  const missingKeyFiles = expectedKeyFiles.filter((p) => !present.has(p));

  const topDirs = topN(byDir, 10).map(([d, c]) => `- ${d}: ${c}`);

  const out = [];
  out.push("RepoReview2: LEGACY snapshot review only");
  out.push("Warning: this is not factual current repo/project state or architecture health.");
  out.push("Truth: use RepoStateAgent.");
  out.push("");
  out.push(`legacySnapshotId: ${latest.id}`);
  out.push(`repo: ${latest.repo || repo || "?"}`);
  out.push(`branch: ${latest.branch || branch || "?"}`);
  out.push(`createdAt: ${latest.created_at || latest.createdAt || "?"}`);
  out.push(`legacyFilesCount: ${filesCount}`);
  out.push("");

  out.push("Top folders in legacy snapshot:");
  if (!topDirs.length) out.push("- (none)");
  else out.push(...topDirs);

  out.push("");
  out.push(`Legacy pillars check: missing=${missingPillars.length}/${requiredPillars.length}`);
  if (missingPillars.length) missingPillars.forEach((p) => out.push(`- MISSING IN LEGACY SNAPSHOT: ${p}`));
  else out.push("- OK in legacy snapshot only");

  out.push("");
  out.push(`Legacy key files check: missing=${missingKeyFiles.length}/${expectedKeyFiles.length}`);
  if (missingKeyFiles.length) missingKeyFiles.forEach((p) => out.push(`- MISSING IN LEGACY SNAPSHOT: ${p}`));
  else out.push("- OK in legacy snapshot only");

  out.push("");
  out.push(`Legacy security path scan: suspicious=${suspicious.length}`);
  if (suspicious.length) suspicious.slice(0, 15).forEach((p) => out.push(`- SUSPICIOUS IN LEGACY SNAPSHOT: ${p}`));
  else out.push("- OK in legacy snapshot only");

  out.push("");
  out.push("Result:");
  out.push("- LEGACY ONLY: do not use this result as factual repo state.");

  await bot.sendMessage(chatId, out.join("\n"));
}