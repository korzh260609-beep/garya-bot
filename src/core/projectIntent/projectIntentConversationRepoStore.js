// src/core/projectIntent/projectIntentConversationRepoStore.js

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { RepoSource } from "../../repo/RepoSource.js";
import {
  safeText,
  normalizeText,
  tokenizeText,
  unique,
  normalizePath,
  sanitizeEntity,
} from "./projectIntentConversationShared.js";

export async function loadLatestSnapshot() {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    return {
      ok: false,
      repo,
      branch,
      latest: null,
      filesCount: 0,
    };
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
    [latest.id]
  );

  return {
    ok: true,
    repo,
    branch,
    latest,
    filesCount: countRes?.rows?.[0]?.cnt ?? 0,
  };
}

export async function pathExistsInSnapshot(snapshotId, path) {
  const res = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [snapshotId, path]
  );
  return Array.isArray(res?.rows) && res.rows.length > 0;
}

export async function fetchPathsByPrefix(snapshotId, prefix = "") {
  const p = safeText(prefix);
  if (!p) {
    const res = await pool.query(
      `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
      [snapshotId]
    );
    return Array.isArray(res?.rows) ? res.rows.map((r) => safeText(r.path)).filter(Boolean) : [];
  }

  const prefixLike = p.endsWith("/") ? `${p}%` : `${p}/%`;
  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 AND path ILIKE $2 ORDER BY path ASC`,
    [snapshotId, prefixLike]
  );
  return Array.isArray(res?.rows) ? res.rows.map((r) => safeText(r.path)).filter(Boolean) : [];
}

export async function fetchAllSnapshotPaths(snapshotId) {
  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
    [snapshotId]
  );
  return Array.isArray(res?.rows) ? res.rows.map((r) => safeText(r.path)).filter(Boolean) : [];
}

export function computeImmediateChildren(paths = [], prefix = "") {
  const normalizedPrefix = safeText(prefix)
    ? (safeText(prefix).endsWith("/") ? safeText(prefix) : `${safeText(prefix)}/`)
    : "";

  const dirs = new Set();
  const files = new Set();

  for (const fullPathRaw of paths) {
    const fullPath = safeText(fullPathRaw);
    if (!fullPath) continue;

    const rest = normalizedPrefix
      ? fullPath.startsWith(normalizedPrefix)
        ? fullPath.slice(normalizedPrefix.length)
        : ""
      : fullPath;

    if (!rest) continue;

    const parts = rest.split("/").filter(Boolean);
    if (!parts.length) continue;

    if (parts.length === 1) {
      files.add(parts[0]);
    } else {
      dirs.add(parts[0]);
    }
  }

  return {
    directories: [...dirs].sort(),
    files: [...files].sort(),
  };
}

function rankPathCandidate(path = "", query = "") {
  const p = safeText(path);
  const q = normalizeText(query);
  const pathLower = p.toLowerCase();
  const base = p.split("/").pop()?.toLowerCase() || "";
  const baseNoExt = base.replace(/\.[^.]+$/i, "");
  const tokens = tokenizeText(query).filter((t) => t.length >= 2);

  let score = 0;

  if (!p || !q) return 0;

  if (pathLower === q) score += 200;
  if (base === q) score += 190;
  if (baseNoExt === q) score += 180;

  if (pathLower.includes(q)) score += 90;
  if (base.includes(q)) score += 80;
  if (baseNoExt.includes(q)) score += 70;

  for (const token of tokens) {
    const t = token.toLowerCase();
    if (pathLower.includes(t)) score += 18;
    if (base.includes(t)) score += 12;
    if (baseNoExt.includes(t)) score += 10;
  }

  if ((q.includes("описан") || q.includes("проект")) && pathLower === "readme.md") {
    score += 120;
  }

  if ((q.includes("decision") || q.includes("decisions") || q.includes("решени")) && pathLower === "pillars/decisions.md") {
    score += 120;
  }

  if (q.includes("workflow") && pathLower === "pillars/workflow.md") {
    score += 120;
  }

  return score;
}

export async function searchSnapshotPaths(snapshotId, query, limit = 8) {
  const q = sanitizeEntity(query);
  if (!q) return [];

  const allPaths = await fetchAllSnapshotPaths(snapshotId);
  const ranked = allPaths
    .map((path) => ({
      path,
      score: rankPathCandidate(path, q),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map((item) => item.path);

  return unique(ranked);
}

export async function fetchRepoFileText({ path, repo, branch, token }) {
  const source = new RepoSource({ repo, branch, token });
  const item = await source.fetchTextFile(path);
  if (!item || typeof item.content !== "string") {
    return null;
  }
  return item.content;
}

export function pickLikelyTargetPathFromKnownEntity(entity = "") {
  const e = sanitizeEntity(entity).toLowerCase();

  if (!e) return "";

  if (e === "workflow") return "pillars/WORKFLOW.md";
  if (e === "decisions" || e === "decision") return "pillars/DECISIONS.md";
  if (e === "roadmap") return "pillars/ROADMAP.md";
  if (e === "project") return "pillars/PROJECT.md";
  if (e === "kingdom") return "pillars/KINGDOM.md";
  if (e === "sg_behavior") return "pillars/SG_BEHAVIOR.md";
  if (e === "sg_entity") return "pillars/SG_ENTITY.md";
  if (e === "repoindex") return "pillars/REPOINDEX.md";
  if (e === "code_insert_rules") return "pillars/CODE_INSERT_RULES.md";
  if (e === "readme" || e === "project_description") return "README.md";

  if (/^[a-z0-9_.\-\/]+\.[a-z0-9]{1,8}$/i.test(e)) return e;
  if (/^[a-z0-9_.\-\/]{3,}$/i.test(e) && e.includes("/")) return e;

  return "";
}

export function pickLikelyTargetPath({
  semanticPlan,
  searchMatches = [],
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const directPath = normalizePath(semanticPlan?.targetPath);
  if (directPath) return directPath;

  const knownPath = pickLikelyTargetPathFromKnownEntity(semanticPlan?.targetEntity);
  if (knownPath) return knownPath;

  const followupPath = normalizePath(followupContext?.targetPath);
  if (followupPath) return followupPath;

  const pendingPath = normalizePath(pendingChoiceContext?.targetPath);
  if (pendingPath) return pendingPath;

  if (Array.isArray(searchMatches) && searchMatches.length > 0) {
    return normalizePath(searchMatches[0]);
  }

  return "";
}

export default {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  fetchPathsByPrefix,
  fetchAllSnapshotPaths,
  computeImmediateChildren,
  searchSnapshotPaths,
  fetchRepoFileText,
  pickLikelyTargetPathFromKnownEntity,
  pickLikelyTargetPath,
};