// src/core/projectIntent/repoStore/projectIntentRepoStoreTargetPicker.js

import {
  safeText,
  normalizePath,
  sanitizeEntity,
} from "../projectIntentConversationShared.js";
import {
  basenameOf,
  hasPathSeparator,
  isFileLike,
  normalizeFolderPath,
  isBareBasenameLike,
  resolveCanonicalPathFromBasename,
} from "./projectIntentRepoStorePathUtils.js";

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

export function pickBestSearchMatch(searchMatches = [], candidate = "", objectKind = "unknown") {
  const matches = Array.isArray(searchMatches) ? searchMatches.filter(Boolean) : [];
  if (!matches.length) return "";

  const normalizedCandidate = safeText(candidate).toLowerCase();
  if (!normalizedCandidate) return normalizePath(matches[0]);

  if (objectKind === "folder") {
    const exactFolder = matches.find(
      (path) =>
        normalizeFolderPath(path).toLowerCase() ===
        normalizeFolderPath(normalizedCandidate).toLowerCase()
    );
    if (exactFolder) return normalizeFolderPath(exactFolder);

    const prefixFolder = matches.find((path) =>
      safeText(path).toLowerCase().startsWith(normalizeFolderPath(normalizedCandidate).toLowerCase())
    );
    if (prefixFolder) return normalizeFolderPath(normalizedCandidate);
  }

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
  const objectKind = safeText(semanticPlan?.objectKind || "unknown");

  const directPath = normalizePath(semanticPlan?.targetPath);
  const directPathLooksFull = hasPathSeparator(directPath);
  const directPathLooksBasename = isBareBasenameLike(directPath);
  const directPathLooksFolder = !!directPath && !isFileLike(directPath);

  const searchBest = pickBestSearchMatch(
    searchMatches,
    directPath || semanticPlan?.targetEntity || "",
    objectKind
  );

  if (objectKind === "folder" && directPathLooksFolder) {
    return normalizeFolderPath(directPath);
  }

  if (directPathLooksFull && objectKind !== "folder") {
    return directPath;
  }

  if (directPathLooksBasename) {
    const canonicalFromBasename = resolveCanonicalPathFromBasename(directPath);
    if (canonicalFromBasename) return canonicalFromBasename;
    if (searchBest) return searchBest;
  }

  const knownPath = pickLikelyTargetPathFromKnownEntity(semanticPlan?.targetEntity);
  if (knownPath) {
    if (objectKind === "folder" && !isFileLike(knownPath)) {
      return normalizeFolderPath(knownPath);
    }
    return knownPath;
  }

  if (searchBest) {
    if (objectKind === "folder" && !isFileLike(searchBest)) {
      return normalizeFolderPath(searchBest);
    }
    return searchBest;
  }

  const followupPath = normalizePath(followupContext?.targetPath);
  if (followupPath) {
    if (objectKind === "folder" && !isFileLike(followupPath)) {
      return normalizeFolderPath(followupPath);
    }
    return followupPath;
  }

  const pendingPath = normalizePath(pendingChoiceContext?.targetPath);
  if (pendingPath) {
    if (objectKind === "folder" && !isFileLike(pendingPath)) {
      return normalizeFolderPath(pendingPath);
    }
    return pendingPath;
  }

  if (directPath) {
    if (objectKind === "folder" && !isFileLike(directPath)) {
      return normalizeFolderPath(directPath);
    }
    return directPath;
  }

  return "";
}

export default {
  pickLikelyTargetPathFromKnownEntity,
  pickBestSearchMatch,
  pickLikelyTargetPath,
};