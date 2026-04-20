// src/core/projectIntent/repoStore/projectIntentRepoStoreSearch.js

import {
  safeText,
  normalizeText,
  tokenizeText,
  unique,
  sanitizeEntity,
} from "../projectIntentConversationShared.js";
import {
  basenameOf,
  isFileLike,
  normalizeFolderPath,
  resolveCanonicalPathFromBasename,
} from "./projectIntentRepoStorePathUtils.js";
import { fetchAllSnapshotPaths } from "./projectIntentRepoStoreSnapshot.js";

export function scoreBasenameMatch(path = "", query = "") {
  const base = basenameOf(path).toLowerCase();
  const q = safeText(query).toLowerCase();

  if (!base || !q) return 0;
  if (base === q) return 300;
  if (base.includes(q)) return 120;
  return 0;
}

export function sortByScoreThenPath(items = []) {
  return [...items].sort((a, b) => {
    if ((b?.score ?? 0) !== (a?.score ?? 0)) {
      return (b?.score ?? 0) - (a?.score ?? 0);
    }
    return safeText(a?.path).localeCompare(safeText(b?.path));
  });
}

export function rankPathCandidate(path = "", query = "", objectKind = "unknown") {
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

  if (objectKind === "folder" && !isFileLike(p)) {
    score += 35;
  }

  if (objectKind === "file" && isFileLike(p)) {
    score += 35;
  }

  if ((q.includes("описан") || q.includes("проект")) && pathLower === "readme.md") {
    score += 140;
  }

  if (
    (q.includes("decision") || q.includes("decisions") || q.includes("решени")) &&
    pathLower === "pillars/decisions.md"
  ) {
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

export async function searchSnapshotPaths(snapshotId, query, limit = 8, options = {}) {
  const q = sanitizeEntity(query);
  if (!q) return [];

  const objectKind = safeText(options?.objectKind || "unknown");
  const canonicalPath = resolveCanonicalPathFromBasename(q);
  const allPaths = await fetchAllSnapshotPaths(snapshotId);

  const ranked = allPaths
    .map((path) => {
      let score = rankPathCandidate(path, q, objectKind);

      if (canonicalPath && safeText(path) === canonicalPath) {
        score += 400;
      }

      score += scoreBasenameMatch(path, q);

      return { path, score };
    })
    .filter((item) => item.score > 0);

  const directFolderPrefix = !isFileLike(q) ? normalizeFolderPath(q) : "";
  if (directFolderPrefix) {
    const prefixed = allPaths
      .filter((path) => safeText(path).toLowerCase().startsWith(directFolderPrefix.toLowerCase()))
      .slice(0, limit)
      .map((path) => ({ path, score: 260 }));

    ranked.push(...prefixed);
  }

  return unique(
    sortByScoreThenPath(ranked)
      .slice(0, limit)
      .map((item) => item.path)
  );
}

export default {
  scoreBasenameMatch,
  sortByScoreThenPath,
  rankPathCandidate,
  searchSnapshotPaths,
};