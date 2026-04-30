// src/core/projectIntent/repoStore/projectIntentRepoStorePathUtils.js

import {
  safeText,
  normalizePath,
} from "../projectIntentConversationShared.js";
import {
  getPillarTargetFromBasename,
  getPreferredPillarPath,
} from "../../../projectExperience/PillarTargetResolver.js";

const CANONICAL_BASENAME_TO_PATH = Object.freeze({
  "workflow.md": getPreferredPillarPath("workflow"),
  "decisions.md": getPreferredPillarPath("decisions"),
  "decision.md": getPreferredPillarPath("decisions"),
  "roadmap.md": getPreferredPillarPath("roadmap"),
  "project.md": getPreferredPillarPath("project"),
  "kingdom.md": getPreferredPillarPath("kingdom"),
  "sg_behavior.md": getPreferredPillarPath("sg_behavior"),
  "sg_entity.md": getPreferredPillarPath("sg_entity"),
  "repoindex.md": getPreferredPillarPath("repoindex"),
  "code_insert_rules.md": getPreferredPillarPath("code_insert_rules"),
  "readme.md": "README.md",
});

export function basenameOf(path = "") {
  return safeText(path).split("/").filter(Boolean).pop() || "";
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
  const target = getPillarTargetFromBasename(key);
  if (target?.preferredPath) return target.preferredPath;
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