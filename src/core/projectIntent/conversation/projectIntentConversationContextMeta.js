// src/core/projectIntent/conversation/projectIntentConversationContextMeta.js

import { safeText } from "../projectIntentConversationShared.js";
import { buildProjectContextScopeFromRepoContext } from "../projectIntentProjectContextScope.js";

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
}) {
  const chunks = Array.isArray(continuationState?.chunks)
    ? continuationState.chunks.filter(Boolean)
    : [];

  const projectContextScope = buildProjectContextScopeFromRepoContext({
    isActive: true,
    targetEntity: safeText(targetEntity),
    targetPath: safeText(targetPath),
  });

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

    projectContextScope,
  };
}

export default {
  replyHuman,
  buildRepoContextMeta,
};