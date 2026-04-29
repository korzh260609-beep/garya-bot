// src/core/projectIntent/conversation/projectIntentConversationHelpers.js
// ============================================================================
// CONVERSATION SHARED HELPERS + LEGACY TECHNICAL HELPERS FACADE
//
// INTERFACE MODE NOTE:
// - Pure path/folder utility helpers remain shared here.
// - Filename-based folder meaning heuristics and legacy phrase/includes
//   active-file follow-up helpers are re-exported from Technical Mode.
// - This file must not become a Human Mode semantic router.
// ============================================================================

import {
  safeText,
  normalizePath,
} from "../projectIntentConversationShared.js";

export function normalizeFolderPrefix(value = "") {
  const v = normalizePath(value);
  if (!v) return "";
  if (v.endsWith("/")) return v;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return v;
  return `${v}/`;
}

export function joinFolderWithBasename(folderPath = "", basename = "") {
  const folder = normalizeFolderPrefix(folderPath);
  const file = safeText(basename).replace(/^\/+/, "");
  if (!folder || !file) return "";
  return `${folder}${file}`;
}

export function inferObjectKindFromPath(path = "") {
  const value = safeText(path);
  if (!value) return "unknown";
  if (/\.[a-z0-9]{1,8}$/i.test(value)) return "file";
  if (value.endsWith("/") || value.includes("/")) return "folder";
  return "unknown";
}

export function basenameNoExt(value = "") {
  const v = safeText(value).split("/").pop() || "";
  return v.replace(/\.[^.]+$/i, "");
}

export {
  classifyChildName,
  buildFolderMeaningFromChildren,
  looksLikeFileInnerQuestion,
  shouldForceActiveFileExplain,
} from "../modes/technical/conversation/projectIntentTechnicalConversationHelpers.js";
