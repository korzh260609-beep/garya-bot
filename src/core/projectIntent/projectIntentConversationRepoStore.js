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

const CANONICAL_BASENAME_TO_PATH = Object.freeze({
  "workflow.md": "pillars/WORKFLOW.md",
  "decisions.md": "pillars/DECISIONS.md",
  "decision.md": "pillars/DECISIONS.md",
  "roadmap.md": "pillars/ROADMAP.md",
  "project.md": "pillars/PROJECT.md",
  "kingdom.md": "pillars/KINGDOM.md",
  "sg_behavior.md": "pillars/SG_BEHAVIOR.md",
  "sg_entity.md": "pillars/SG_ENTITY.md",
  "repoindex.md": "pillars/REPOINDEX.md",
  "code_insert_rules.md": "pillars/CODE_INSERT_RULES.md",
  "readme.md": "README.md",
});

function basenameOf(path = "") {
  return safeText(path).split("/").pop() || "";
}

function hasPathSeparator(value = "") {
  return safeText(value).includes("/");
}

function isFileLike(value = "") {
  return /\.[a-z0-9]{1,8}$/i.test(safeText(value));
}

function isBareBasenameLike(value = "") {
  const v = safeText(value);
  return !!v && !hasPathSeparator(v) && isFileLike(v);
}

function resolveCanonicalPathFromBasename(value = "") {
  const key = safeText(value).toLowerCase();
  return CANONICAL_BASENAME_TO_PATH[key] || "";
}

function scoreBasenameMatch(path = "", query = "") {
  const base = basenameOf(path).toLowerCase();
  const q = safeText(query).toLowerCase();

  if (!base || !q) return 0;
  if (base === q) return 300;
  if (base.includes(q)) return 120;
  return 0;
}

function sortByScoreThenPath(items = []) {
  return [...items].sort((a, b) => {
    if ((b?.score ?? 0) !== (a?.score ?? 0)) {
      return (b?.score ?? 0) - (a?.score ?? 0);
    }
    return safeText(a?.path).localeCompare(safeText(b?.path));
  });
}

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
  const normalized = normalizePath(path);
  if (!normalized) return false;

  const res = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [snapshotId, normalized]
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
  const base = basenameOf(p).toLowerCase();
  const baseNoExt = base.replace(/\.[^.]+$/i, "");
  const tokens = tokenizeText(query).filter((t) => t.length >= 2);

  let score = 0;

  if (!p || !q) return 0;

  if (pathLower === q) score += 220;
  if (base === q) score += 210;
  if (baseNoExt === q) score += 190;

  if (pathLower.includes(q)) score += 95;
  if (base.includes(q)) score += 90;
  if (baseNoExt.includes(q)) score += 75;

  for (const token of tokens) {
    const t = token.toLowerCase();
    if (pathLower.includes(t)) score += 18;
    if (base.includes(t)) score += 15;
    if (baseNoExt.includes(t)) score += 10;
  }

  if ((q.includes("описан") || q.includes("проект")) && pathLower === "readme.md") {
    score += 140;
  }

  if ((q.includes("decision") || q.includes("decisions") || q.includes("решени")) && pathLower === "pillars/decisions.md") {
    score += 150;
  }

  if (q.includes("workflow") && pathLower === "pillars/workflow.md") {
    score += 150;
  }

  if (q.includes("sg_behavior") && pathLower === "pillars/sg_behavior.md") {
    score += 180;
  }

  if (q.includes("sg_entity") && pathLower === "pillars/sg_entity.md") {
    score += 180;
  }

  return score;
}

export async function searchSnapshotPaths(snapshotId, query, limit = 8) {
  const q = sanitizeEntity(query);
  if (!q) return [];

  const canonicalPath = resolveCanonicalPathFromBasename(q);
  const allPaths = await fetchAllSnapshotPaths(snapshotId);

  const ranked = allPaths
    .map((path) => {
      let score = rankPathCandidate(path, q);

      if (canonicalPath && safeText(path) === canonicalPath) {
        score += 400;
      }

      score += scoreBasenameMatch(path, q);

      return { path, score };
    })
    .filter((item) => item.score > 0);

  return unique(
    sortByScoreThenPath(ranked)
      .slice(0, limit)
      .map((item) => item.path)
  );
}

export async function fetchRepoFileText({ path, repo, branch, token }) {
  const normalized = normalizePath(path);
  if (!normalized) return null;

  const source = new RepoSource({ repo, branch, token });
  const item = await source.fetchTextFile(normalized);
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

  const canonicalFromBasename = resolveCanonicalPathFromBasename(e);
  if (canonicalFromBasename) return canonicalFromBasename;

  if (/^[a-z0-9_.\-\/]+\.[a-z0-9]{1,8}$/i.test(e) && e.includes("/")) return e;
  if (/^[a-z0-9_.\-\/]{3,}$/i.test(e) && e.includes("/")) return e;

  return "";
}

function pickBestSearchMatch(searchMatches = [], candidate = "") {
  const matches = Array.isArray(searchMatches) ? searchMatches.filter(Boolean) : [];
  if (!matches.length) return "";

  const normalizedCandidate = safeText(candidate).toLowerCase();
  if (!normalizedCandidate) return normalizePath(matches[0]);

  const exactBase = matches.find((path) => basenameOf(path).toLowerCase() === normalizedCandidate);
  if (exactBase) return normalizePath(exactBase);

  const exactPath = matches.find((path) => safeText(path).toLowerCase() === normalizedCandidate);
  if (exactPath) return normalizePath(exactPath);

  return normalizePath(matches[0]);
}

export function pickLikelyTargetPath({
  semanticPlan,
  searchMatches = [],
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const directPath = normalizePath(semanticPlan?.targetPath);
  const directPathLooksFull = hasPathSeparator(directPath);
  const directPathLooksBasename = isBareBasenameLike(directPath);

  const searchBest = pickBestSearchMatch(
    searchMatches,
    directPath || semanticPlan?.targetEntity || ""
  );

  if (directPathLooksFull) {
    return directPath;
  }

  if (directPathLooksBasename) {
    const canonicalFromBasename = resolveCanonicalPathFromBasename(directPath);
    if (canonicalFromBasename) return canonicalFromBasename;
    if (searchBest) return searchBest;
  }

  const knownPath = pickLikelyTargetPathFromKnownEntity(semanticPlan?.targetEntity);
  if (knownPath) return knownPath;

  if (searchBest) return searchBest;

  const followupPath = normalizePath(followupContext?.targetPath);
  if (followupPath) return followupPath;

  const pendingPath = normalizePath(pendingChoiceContext?.targetPath);
  if (pendingPath) return pendingPath;

  if (directPath) return directPath;

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