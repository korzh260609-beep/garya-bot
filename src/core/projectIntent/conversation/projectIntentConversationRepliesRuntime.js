// src/core/projectIntent/conversation/projectIntentConversationRepliesRuntime.js

import {
  fetchPathsByPrefix,
  computeImmediateChildren,
  fetchRepoFileText,
} from "../projectIntentConversationRepoStore.js";
import {
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
  buildAiMessages,
  replyHuman,
  buildRepoContextMeta,
} from "../projectIntentConversationReplies.js";
import { safeText } from "../projectIntentConversationShared.js";
import {
  getReplyLimitFromReplyAndLog,
  buildPackedExplainText,
  buildContinuationChunkReply,
} from "../projectIntentResponsePacker.js";
import {
  normalizeFolderPrefix,
  inferObjectKindFromPath,
  buildFolderMeaningFromChildren,
} from "./projectIntentConversationHelpers.js";
import { detectRepoExplainGroundingFailure } from "./projectIntentConversationAiGuard.js";

const LARGE_DOC_AI_THRESHOLD = 12000;

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
  });

  contextMeta.projectIntentObjectKind = safeText(objectKind || inferObjectKindFromPath(targetPath));

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
  });

  contextMeta.projectIntentObjectKind = safeText(
    followupContext?.objectKind || inferObjectKindFromPath(followupContext?.targetPath || continuation?.targetPath)
  );

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

export async function replyFolderBrowseFromPath({
  replyAndLog,
  folderPath,
  targetEntity,
  sourceText,
  semanticConfidence,
  actionKind,
  latestSnapshotId,
  event,
}) {
  const requestedFolder = normalizeFolderPrefix(folderPath);

  if (!requestedFolder) {
    await replyHuman(
      replyAndLog,
      humanClarificationReply("Нужен точный путь папки."),
      { event: `${event}_clarification` }
    );
    return {
      handled: true,
      reason: "browse_folder_clarification",
    };
  }

  const allPaths = await fetchPathsByPrefix(latestSnapshotId, requestedFolder);
  const { directories, files } = computeImmediateChildren(allPaths, requestedFolder);

  if (directories.length === 0 && files.length === 0) {
    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath: requestedFolder,
      displayMode: "raw",
      sourceText,
      treePrefix: requestedFolder,
      semanticConfidence,
      actionKind,
    });

    contextMeta.projectIntentObjectKind = "folder";

    await replyHuman(
      replyAndLog,
      `\`${requestedFolder}\` — папка репозитория без видимых вложенных элементов в текущем снимке.`,
      {
        event: `${event}_empty`,
        read_only: true,
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "browse_folder_empty",
      contextMeta,
    };
  }

  const shownDirectories = directories.slice(0, 30);
  const shownFiles = files.slice(0, 30);
  const hiddenCount =
    Math.max(0, directories.length - shownDirectories.length) +
    Math.max(0, files.length - shownFiles.length);

  const text = humanFolderBrowseReply({
    folderPath: requestedFolder,
    directories: shownDirectories,
    files: shownFiles,
    hiddenCount,
  });

  const contextMeta = buildRepoContextMeta({
    targetEntity,
    targetPath: requestedFolder,
    displayMode: "raw",
    sourceText,
    treePrefix: requestedFolder,
    semanticConfidence,
    actionKind,
  });

  contextMeta.projectIntentObjectKind = "folder";

  await replyHuman(replyAndLog, text, {
    event,
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "browse_folder_human",
    contextMeta,
  };
}

export async function replyExplainFolderFromPath({
  replyAndLog,
  folderPath,
  targetEntity,
  sourceText,
  semanticConfidence,
  actionKind,
  latestSnapshotId,
  event,
}) {
  const requestedFolder = normalizeFolderPrefix(folderPath);

  if (!requestedFolder) {
    await replyHuman(
      replyAndLog,
      humanClarificationReply("Нужен точный путь папки для объяснения."),
      { event: `${event}_clarification` }
    );
    return {
      handled: true,
      reason: "explain_folder_clarification",
    };
  }

  const allPaths = await fetchPathsByPrefix(latestSnapshotId, requestedFolder);
  const { directories, files } = computeImmediateChildren(allPaths, requestedFolder);

  if (directories.length === 0 && files.length === 0) {
    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath: requestedFolder,
      displayMode: "summary",
      sourceText,
      treePrefix: requestedFolder,
      semanticConfidence,
      actionKind,
    });

    contextMeta.projectIntentObjectKind = "folder";

    await replyHuman(
      replyAndLog,
      `\`${requestedFolder}\` — папка без видимого содержимого в текущем снимке. Этого недостаточно для надёжного объяснения роли.`,
      {
        event: `${event}_empty`,
        read_only: true,
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "explain_folder_empty",
      contextMeta,
    };
  }

  const shownDirectories = directories.slice(0, 20);
  const shownFiles = files.slice(0, 20);
  const hiddenCount =
    Math.max(0, directories.length - shownDirectories.length) +
    Math.max(0, files.length - shownFiles.length);

  const text = buildFolderMeaningFromChildren({
    folderPath: requestedFolder,
    directories: shownDirectories,
    files: shownFiles,
    hiddenCount,
  });

  const contextMeta = buildRepoContextMeta({
    targetEntity,
    targetPath: requestedFolder,
    displayMode: "summary",
    sourceText,
    treePrefix: requestedFolder,
    semanticConfidence,
    actionKind,
  });

  contextMeta.projectIntentObjectKind = "folder";

  await replyHuman(replyAndLog, text, {
    event,
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "explain_folder_human",
    contextMeta,
  };
}

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
    });

    contextMeta.projectIntentObjectKind = "file";

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
  });

  contextMeta.projectIntentObjectKind = "file";

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

  if (forceFirstPart || displayMode === "raw_first_part") {
    const contextMeta = buildRepoContextMeta({
      targetEntity,
      targetPath,
      displayMode: "raw_first_part",
      sourceText,
      largeDocument: content.length > replyLimit,
      semanticConfidence,
      actionKind,
    });

    contextMeta.projectIntentObjectKind = "file";

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
    });

    contextMeta.projectIntentObjectKind = "file";

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
    });

    contextMeta.projectIntentObjectKind = "file";
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
  });

  return {
    handled: true,
    reason: "explain_ai",
    contextMeta,
  };
}

export default {
  replyPackedExplain,
  replyContinuation,
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
  replyOpenFileFromPath,
  replyExplainFileFromPath,
};