// src/core/projectIntent/modes/technical/conversation/repliesRuntime/projectIntentTechnicalPackedReplies.js
// ============================================================================
// TECHNICAL MODE PACKED / CONTINUATION REPLIES
//
// INTERFACE MODE NOTE:
// - Legacy Technical Mode reply packing and continuation behavior.
// - This is not Human Mode intelligence.
// - Do not add phrase-bound Human Mode behavior here.
// ============================================================================

import {
  replyHuman,
  buildRepoContextMeta,
} from "../../../../projectIntentConversationReplies.js";
import { safeText } from "../../../../projectIntentConversationShared.js";
import {
  getReplyLimitFromReplyAndLog,
  buildPackedExplainText,
  buildContinuationChunkReply,
} from "../../../../projectIntentResponsePacker.js";
import {
  inferObjectKindFromPath,
} from "../../../../conversation/projectIntentConversationHelpers.js";
import {
  pickProjectContextScope,
} from "./projectIntentTechnicalReplyShared.js";

export async function replyPackedExplain({
  replyAndLog,
  aiReply,
  targetEntity,
  targetPath,
  displayMode,
  sourceText,
  semanticConfidence,
  actionKind,
  objectKind,
  event,
  projectContextScope = null,
}) {
  const replyLimit = getReplyLimitFromReplyAndLog(replyAndLog);

  const packed = buildPackedExplainText({
    aiReply,
    targetPath,
    displayMode,
    replyLimit,
  });

  const contextMeta = buildRepoContextMeta({
    targetEntity,
    targetPath,
    displayMode,
    sourceText,
    largeDocument: packed.largeDocument === true,
    pendingChoice: packed.pendingChoice,
    semanticConfidence,
    actionKind,
    continuationState: packed.continuationState,
    objectKind: safeText(objectKind || inferObjectKindFromPath(targetPath)),
    projectContextScope: pickProjectContextScope(projectContextScope),
  });

  await replyHuman(
    replyAndLog,
    safeText(packed.text) || "Объяснение не удалось сформировать достаточно надёжно.",
    {
      event,
      ...contextMeta,
    }
  );

  return contextMeta;
}

export async function replyContinuation({
  replyAndLog,
  followupContext,
  sourceText,
  semanticConfidence,
  actionKind,
  event,
  projectContextScope = null,
}) {
  const continuation = followupContext?.continuation || {};
  const continuationReply = buildContinuationChunkReply({
    continuationState: continuation,
  });

  if (!continuationReply.ok) {
    await replyHuman(
      replyAndLog,
      "Продолжения больше нет. Дальше можно заново кратко пересказать объект или объяснить его смысл.",
      {
        event: "repo_conversation_no_more_continuation",
        read_only: true,
      }
    );

    return {
      handled: true,
      reason: "no_more_continuation",
      contextMeta: buildRepoContextMeta({
        targetEntity: followupContext?.targetEntity,
        targetPath: followupContext?.targetPath,
        displayMode: followupContext?.displayMode,
        sourceText,
        largeDocument: false,
        pendingChoice: null,
        treePrefix: followupContext?.treePrefix,
        semanticConfidence,
        actionKind,
        continuationState: continuationReply.nextState,
        objectKind: safeText(
          followupContext?.objectKind ||
          inferObjectKindFromPath(followupContext?.targetPath)
        ),
        projectContextScope: pickProjectContextScope(
          projectContextScope,
          followupContext?.projectContextScope
        ),
      }),
    };
  }

  const contextMeta = buildRepoContextMeta({
    targetEntity: followupContext?.targetEntity,
    targetPath: followupContext?.targetPath || continuation?.targetPath,
    displayMode: continuation?.displayMode || followupContext?.displayMode,
    sourceText,
    largeDocument: continuationReply.hasMore,
    pendingChoice: continuationReply.hasMore
      ? {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: followupContext?.targetEntity,
          targetPath: followupContext?.targetPath || continuation?.targetPath,
          displayMode: continuation?.displayMode || followupContext?.displayMode,
        }
      : null,
    treePrefix: followupContext?.treePrefix,
    semanticConfidence,
    actionKind,
    continuationState: continuationReply.nextState,
    objectKind: safeText(
      followupContext?.objectKind ||
      inferObjectKindFromPath(followupContext?.targetPath || continuation?.targetPath)
    ),
    projectContextScope: pickProjectContextScope(
      projectContextScope,
      followupContext?.projectContextScope
    ),
  });

  await replyHuman(
    replyAndLog,
    continuationReply.text,
    {
      event,
      ...contextMeta,
    }
  );

  return {
    handled: true,
    reason: "continuation_replied",
    contextMeta,
  };
}

export default {
  replyPackedExplain,
  replyContinuation,
};
