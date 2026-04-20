// src/core/projectIntent/repoStore/projectIntentRepoStorePathUtils.js

import {
  safeText,
  normalizePath,
} from "../projectIntentConversationShared.js";

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

export function basenameOf(path = "") {
  return safeText(path).split("/").pop() || "";
}

export function hasPathSeparator(value = "") {
  return safeText(value).includes("/");
}

export function isFileLike(value = "") {
  return /\.[a-z0-9]{1,8}$/i.test(safeText(value));
}

export function isFolderLike(value = "") {
  const v = safeText(value);
  if (!v) return false;
  if (isFileLike(v)) return false;
  return v.includes("/") || /^[a-z0-9_.-]+$/i.test(v);
}

export function normalizeFolderPath(value = "") {
  const v = normalizePath(value);
  if (!v) return "";
  if (isFileLike(v)) return v;
  return v.endsWith("/") ? v : `${v}/`;
}

export function isBareBasenameLike(value = "") {
  const v = safeText(value);
  return !!v && !hasPathSeparator(v) && isFileLike(v);
}

export function resolveCanonicalPathFromBasename(value = "") {
  const key = safeText(value).toLowerCase();
  return CANONICAL_BASENAME_TO_PATH[key] || "";
}

export default {
  basenameOf,
  hasPathSeparator,
  isFileLike,
  isFolderLike,
  normalizeFolderPath,
  isBareBasenameLike,
  resolveCanonicalPathFromBasename,
};