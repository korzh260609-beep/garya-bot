// ============================================================================
// === src/bot/handlers/repoReview2.js — repo health check from snapshot (DB-only)
// === READ-ONLY, no GitHub fetch
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

  // snapshot должен быть чистым: в нем не должно быть env/keys
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

export async function handleRepoReview2({ bot, chatId, senderIdStr }) {
  const effectiveUserIdStr = senderIdStr ? String(senderIdStr) : String(chatId);

  const ok = await requireMonarch(bot, chatId, effectiveUserIdStr);
  if (!ok) return;

  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    await bot.sendMessage(chatId, "RepoReview2: no snapshots yet (run /reindex first)");
    return;
  }

  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
    [latest.id]
  );

  const paths = (res.rows || []).map((r) => r.path).filter(Boolean);

  const filesCount = paths.length;

  // Folder breakdown
  const byDir = {};
  for (const p of paths) {
    const d = dirOf(p);
    byDir[d] = (byDir[d] || 0) + 1;
  }

  // Required pillars (strict, based on your screenshot list)
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

  // Suspicious paths (should be none)
  const suspicious = paths.filter(isSuspicious);

  // Key capability presence (minimal sanity)
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
  out.push("RepoReview2: ok");
  out.push(`snapshotId: ${latest.id}`);
  out.push(`repo: ${latest.repo || repo || "?"}`);
  out.push(`branch: ${latest.branch || branch || "?"}`);
  out.push(`createdAt: ${latest.created_at || latest.createdAt || "?"}`);
  out.push(`filesCount: ${filesCount}`);
  out.push("");

  out.push("Top folders (by files):");
  if (!topDirs.length) out.push("- (none)");
  else out.push(...topDirs);

  out.push("");
  out.push(`Pillars: missing=${missingPillars.length}/${requiredPillars.length}`);
  if (missingPillars.length) missingPillars.forEach((p) => out.push(`- MISSING: ${p}`));
  else out.push("- OK (all required pillars present)");

  out.push("");
  out.push(`Key files: missing=${missingKeyFiles.length}/${expectedKeyFiles.length}`);
  if (missingKeyFiles.length) missingKeyFiles.forEach((p) => out.push(`- MISSING: ${p}`));
  else out.push("- OK (all key files present)");

  out.push("");
  out.push(`Security scan (paths): suspicious=${suspicious.length}`);
  if (suspicious.length) suspicious.slice(0, 15).forEach((p) => out.push(`- SUSPICIOUS: ${p}`));
  else out.push("- OK (no suspicious paths in snapshot)");

  out.push("");
  out.push("Result:");
  if (missingPillars.length || missingKeyFiles.length || suspicious.length) {
    out.push("- NOT CLEAN: fix missing/suspicious items, then /reindex");
  } else {
    out.push("- CLEAN: snapshot structure looks consistent ✅");
  }

  await bot.sendMessage(chatId, out.join("\n"));
}
