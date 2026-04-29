// src/core/projectIntent/modes/technical/conversation/repliesRuntime/projectIntentTechnicalFolderReplies.js
// ============================================================================
// TECHNICAL MODE FOLDER REPLIES RUNTIME
//
// INTERFACE MODE NOTE:
// - Legacy Technical Mode folder browse/explain reply behavior.
// - This is not Human Mode intelligence.
// - Do not add phrase-bound Human Mode behavior here.
// ============================================================================

import {
  fetchPathsByPrefix,
  computeImmediateChildren,
} from "../../../../projectIntentConversationRepoStore.js";
import {
  humanFolderBrowseReply,
  humanClarificationReply,
  replyHuman,
  buildRepoContextMeta,
} from "../../../../projectIntentConversationReplies.js";
import {
  normalizeFolderPrefix,
  buildFolderMeaningFromChildren,
} from "../../../../conversation/projectIntentConversationHelpers.js";
import {
  pickProjectContextScope,
} from "./projectIntentTechnicalReplyShared.js";

export async function replyFolderBrowseFromPath({
  replyAndLog,
  folderPath,
  targetEntity,
  sourceText,
  semanticConfidence,
  actionKind,
  latestSnapshotId,
  event,
  projectContextScope = null,
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
      objectKind: "folder",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

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
    objectKind: "folder",
    projectContextScope: pickProjectContextScope(projectContextScope),
  });

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
  projectContextScope = null,
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
      objectKind: "folder",
      projectContextScope: pickProjectContextScope(projectContextScope),
    });

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
    objectKind: "folder",
    projectContextScope: pickProjectContextScope(projectContextScope),
  });

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

export default {
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
};
