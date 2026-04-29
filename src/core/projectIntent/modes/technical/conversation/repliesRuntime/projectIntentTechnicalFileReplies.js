// src/core/projectIntent/modes/technical/conversation/repliesRuntime/projectIntentTechnicalFileReplies.js
// ============================================================================
// TECHNICAL MODE FILE REPLIES RUNTIME
//
// INTERFACE MODE NOTE:
// - Legacy Technical Mode file open/explain reply behavior.
// - This is not Human Mode intelligence.
// - Do not add phrase-bound Human Mode behavior here.
// ============================================================================

import {
  fetchRepoFileText,
} from "../../../../projectIntentConversationRepoStore.js";
import {
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  replyHuman,
  buildRepoContextMeta,
  buildAiMessages,
} from "../../../../projectIntentConversationReplies.js";
import { safeText } from "../../../../projectIntentConversationShared.js";
import {
  getReplyLimitFromReplyAndLog,
} from "../../../../projectIntentResponsePacker.js";
import { detectRepoExplainGroundingFailure } from "../../../../conversation/projectIntentConversationAiGuard.js";
import { resolveStructuredRepoFileAnswer } from "../../../../conversation/projectIntentConversationStructuredRead.js";
import {
  LARGE_DOC_AI_THRESHOLD,
  pickProjectContextScope,
} from "./projectIntentTechnicalReplyShared.js";
import {
  replyPackedExplain,
} from "./projectIntentTechnicalPackedReplies.js";

export async function replyOpenFileFromPath({
  replyAndLog,
  targetPath,
  targetEntity,
  sourceText,
  semanticConfidence,
  actionKind,
  repo,
  branch,
  token,
  event,
  projectContextScope = null,
}) {
  const replyLimit = getReplyLimitFromReplyAndLog(replyAndLog);
  const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });

  if (!content) {
    await replyHuman(
      replyAndLog,
      `\`${targetPath}\` найден, но содержимое файла прочитать не удалось.`,
      { event: `${event}_fetch_failed` }
    );
    return { handled: true, reason: "open_fetch_failed" };
  }

  if (content.length > replyLimit) {
    const text = humanLargeDocumentReply({ path: targetPath });

    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath,
      displayMode: "raw",
      sourceText,
      largeDocument: true,
      pendingChoice: {
        isActive: true,
        kind: "large_doc_action",
        targetEntity,
        targetPath,
        displayMode: "summary",
      },
      semanticConfidence,
      actionKind,
      objectKind: "file",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

    await replyHuman(replyAndLog, text, {
      event,
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "open_large_doc",
      contextMeta,
    };
  }

  const preview = content.slice(0, replyLimit);
  const contextMeta = buildRepoContextMeta({
    targetEntity,
    targetPath,
    displayMode: "raw",
    sourceText,
    largeDocument: false,
    semanticConfidence,
    actionKind,
    objectKind: "file",
    projectContextScope: pickProjectContextScope(projectContextScope),
  });

  await replyHuman(
    replyAndLog,
    humanSmallDocumentReply({
      path: targetPath,
      content: preview,
      wasTrimmed: content.length > replyLimit,
    }),
    {
      event,
      ...contextMeta,
    }
  );

  return {
    handled: true,
    reason: "open_small_doc",
    contextMeta,
  };
}

export async function replyExplainFileFromPath({
  replyAndLog,
  trimmed,
  targetPath,
  targetEntity,
  displayMode,
  sourceText,
  semanticConfidence,
  actionKind,
  repo,
  branch,
  token,
  callAI,
  event,
  forceFirstPart = false,
  projectContextScope = null,
}) {
  const replyLimit = getReplyLimitFromReplyAndLog(replyAndLog);
  const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });

  if (!content) {
    await replyHuman(
      replyAndLog,
      `\`${targetPath}\` найден, но сам файл прочитать не удалось.`,
      { event: `${event}_fetch_failed` }
    );
    return { handled: true, reason: "explain_fetch_failed" };
  }

  if (!forceFirstPart && displayMode !== "raw_first_part") {
    const structuredAnswer = resolveStructuredRepoFileAnswer({
      text: trimmed,
      targetPath,
      content,
      replyLimit,
    });

    if (structuredAnswer.ok) {
      const contextMeta = buildRepoContextMeta({
        targetEntity,
        targetPath,
        displayMode: "summary",
        sourceText,
        largeDocument: false,
        semanticConfidence,
        actionKind: `${safeText(actionKind)}_${safeText(structuredAnswer.kind)}`,
        objectKind: "file",
        projectContextScope: pickProjectContextScope(projectContextScope),
      });

      contextMeta.projectIntentStructuredReadKind = safeText(structuredAnswer.kind);

      await replyHuman(
        replyAndLog,
        structuredAnswer.text,
        {
          event: `${event}_structured_read`,
          ...contextMeta,
        }
      );

      return {
        handled: true,
        reason: `structured_${safeText(structuredAnswer.kind)}`,
        contextMeta,
      };
    }
  }

  if (forceFirstPart || displayMode === "raw_first_part") {
    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath,
      displayMode: "raw_first_part",
      sourceText,
      largeDocument: content.length > replyLimit,
      semanticConfidence,
      actionKind,
      objectKind: "file",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

    await replyHuman(
      replyAndLog,
      humanFirstPartDocumentReply({
        path: targetPath,
        content,
        maxChars: replyLimit,
      }),
      {
        event,
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "first_part_shown",
      contextMeta,
    };
  }

  if (content.length > LARGE_DOC_AI_THRESHOLD) {
    const text = humanLargeDocumentReply({ path: targetPath });

    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath,
      displayMode,
      sourceText,
      largeDocument: true,
      pendingChoice: {
        isActive: true,
        kind: "large_doc_action",
        targetEntity,
        targetPath,
        displayMode,
      },
      semanticConfidence,
      actionKind,
      objectKind: "file",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

    await replyHuman(replyAndLog, text, {
      event,
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "explain_large_doc",
      contextMeta,
    };
  }

  const aiReply = await callAI(
    buildAiMessages({
      userText: trimmed,
      path: targetPath,
      content,
      displayMode,
    }),
    "high",
    {
      max_completion_tokens: 900,
      temperature: 0.15,
    }
  );

  const groundingFailure = detectRepoExplainGroundingFailure({
    aiReply,
    content,
  });

  if (groundingFailure.failed) {
    const fallbackIntro =
      `\`${targetPath}\` прочитан напрямую, ` +
      "но автоматическое объяснение было отброшено, потому что оно противоречило реально доступному содержимому объекта.";

    const reservedIntroSpace = Math.max(220, fallbackIntro.length + 40);
    const safePreviewLimit = Math.max(900, replyLimit - reservedIntroSpace);

    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath,
      displayMode: "raw_first_part",
      sourceText,
      largeDocument: content.length > safePreviewLimit,
      semanticConfidence,
      actionKind: `${safeText(actionKind)}_grounding_rejected`,
      objectKind: "file",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

    contextMeta.projectIntentAiGuardReason = groundingFailure.reason;
    contextMeta.projectIntentAiGuardPatternsJson =
      groundingFailure.matchedPatterns.length > 0
        ? JSON.stringify(groundingFailure.matchedPatterns)
        : "";

    await replyHuman(
      replyAndLog,
      [
        fallbackIntro,
        "",
        humanFirstPartDocumentReply({
          path: targetPath,
          content,
          maxChars: safePreviewLimit,
        }),
      ].join("\n"),
      {
        event: `${event}_grounding_rejected`,
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "explain_ai_grounding_rejected",
      contextMeta,
    };
  }

  const contextMeta = await replyPackedExplain({
    replyAndLog,
    aiReply,
    targetEntity,
    targetPath,
    displayMode,
    sourceText,
    semanticConfidence,
    actionKind,
    objectKind: "file",
    event,
    projectContextScope: pickProjectContextScope(projectContextScope),
  });

  return {
    handled: true,
    reason: "explain_ai",
    contextMeta,
  };
}

export default {
  replyOpenFileFromPath,
  replyExplainFileFromPath,
};
