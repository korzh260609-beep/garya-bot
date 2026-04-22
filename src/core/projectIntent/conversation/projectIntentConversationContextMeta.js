// src/core/projectIntent/conversation/projectIntentConversationContextMeta.js

import { safeText } from "../projectIntentConversationShared.js";
import { buildProjectContextScopeFromRepoContext } from "../projectIntentProjectContextScope.js";

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

export async function replyHuman(replyAndLog, text, meta = {}) {
  if (typeof replyAndLog !== "function") return;
  await replyAndLog(text, {
    read_only: true,
    ...meta,
  });
}

export function buildRepoContextMeta({
  targetEntity,
  targetPath,
  displayMode,
  sourceText,
  largeDocument = false,
  pendingChoice = null,
  treePrefix = "",
  semanticConfidence = "low",
  actionKind = "",
  continuationState = null,
  objectKind = "",
  projectContextScope = null,
}) {
  const chunks = Array.isArray(continuationState?.chunks)
    ? continuationState.chunks.filter(Boolean)
    : [];

  const explicitScope = normalizeProjectContextScope(projectContextScope);
  const fallbackScope = buildProjectContextScopeFromRepoContext({
    isActive: true,
    targetEntity: safeText(targetEntity),
    targetPath: safeText(targetPath),
    objectKind: safeText(objectKind),
  });

  const mergedScope = {
    ...fallbackScope,
    ...explicitScope,
  };

  return {
    projectIntentRepoContextActive: true,
    projectIntentTargetEntity: safeText(targetEntity),
    projectIntentTargetPath: safeText(targetPath),
    projectIntentDisplayMode: safeText(displayMode),
    projectIntentSourceText: safeText(sourceText),
    projectIntentLargeDocument: largeDocument === true,
    projectIntentTreePrefix: safeText(treePrefix),
    projectIntentSemanticConfidence: safeText(semanticConfidence),
    projectIntentActionKind: safeText(actionKind),
    projectIntentObjectKind: safeText(objectKind),

    projectIntentPendingChoiceActive: !!pendingChoice?.isActive,
    projectIntentPendingChoiceKind: safeText(pendingChoice?.kind),
    projectIntentPendingChoiceTargetEntity: safeText(pendingChoice?.targetEntity),
    projectIntentPendingChoiceTargetPath: safeText(pendingChoice?.targetPath),
    projectIntentPendingChoiceDisplayMode: safeText(pendingChoice?.displayMode),

    projectIntentContinuationActive: continuationState?.isActive === true,
    projectIntentContinuationSourceKind: safeText(continuationState?.sourceKind),
    projectIntentContinuationTargetPath: safeText(continuationState?.targetPath),
    projectIntentContinuationDisplayMode: safeText(continuationState?.displayMode),
    projectIntentContinuationChunkIndex: Number(continuationState?.chunkIndex || 1),
    projectIntentContinuationChunkCount: Number(
      continuationState?.chunkCount || chunks.length || 0
    ),
    projectIntentContinuationChunksJson: chunks.length > 0 ? JSON.stringify(chunks) : "",
    projectIntentContinuationRemainingText: safeText(
      continuationState?.remainingText
    ),

    projectContextScope: mergedScope,
  };
}

export default {
  replyHuman,
  buildRepoContextMeta,
};