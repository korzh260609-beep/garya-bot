// src/core/projectIntent/semantic/projectIntentSemanticSanitizer.js

import { safeText } from "./projectIntentSemanticText.js";

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOptionalText(value) {
  const s = safeText(value).toLowerCase();
  return s || "";
}

function normalizeProjectContextScope(value) {
  const source = safeObject(value);
  const out = {};

  const projectArea = normalizeOptionalText(source.projectArea);
  if (projectArea) out.projectArea = projectArea;

  const repoScope = normalizeOptionalText(source.repoScope);
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = normalizeOptionalText(source.linkedArea);
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = normalizeOptionalText(source.linkedRepo);
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

export function sanitizeSemanticResult(raw, fallback) {
  const result = raw && typeof raw === "object" ? raw : {};

  const allowedIntents = new Set([
    "repo_status",
    "show_tree",
    "browse_folder",
    "find_target",
    "find_and_explain",
    "open_target",
    "explain_target",
    "explain_active",
    "answer_pending_choice",
    "continue_active",
    "unknown",
  ]);

  const allowedDisplayModes = new Set([
    "raw",
    "raw_first_part",
    "summary",
    "explain",
    "translate_ru",
  ]);

  const allowedConfidence = new Set([
    "low",
    "medium",
    "high",
  ]);

  const allowedObjectKinds = new Set([
    "repo",
    "root",
    "folder",
    "file",
    "unknown",
  ]);

  const intent = allowedIntents.has(result.intent)
    ? result.intent
    : fallback.intent;

  const fallbackScope = normalizeProjectContextScope(fallback?.projectContextScope);
  const resultScope = normalizeProjectContextScope(result?.projectContextScope);

  const mergedScope = {
    ...fallbackScope,
    ...resultScope,
  };

  return {
    intent,
    targetEntity: safeText(result.targetEntity || fallback.targetEntity),
    targetPath: safeText(result.targetPath || fallback.targetPath),
    displayMode: allowedDisplayModes.has(safeText(result.displayMode))
      ? safeText(result.displayMode)
      : safeText(fallback.displayMode || "raw"),
    treePrefix: safeText(result.treePrefix || fallback.treePrefix || ""),
    objectKind: allowedObjectKinds.has(safeText(result.objectKind))
      ? safeText(result.objectKind)
      : safeText(fallback.objectKind || "unknown"),
    clarifyNeeded: result.clarifyNeeded === true ? true : fallback.clarifyNeeded === true,
    clarifyQuestion: safeText(result.clarifyQuestion || fallback.clarifyQuestion),
    confidence: allowedConfidence.has(safeText(result.confidence))
      ? safeText(result.confidence)
      : safeText(fallback.confidence || "low"),
    projectContextScope: mergedScope,
  };
}