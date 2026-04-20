// src/core/projectIntent/conversation/projectIntentConversationObjectActions.js

import {
  searchSnapshotPaths,
} from "../projectIntentConversationRepoStore.js";
import {
  humanClarificationReply,
  replyHuman,
} from "../projectIntentConversationReplies.js";
import {
  safeText,
  sanitizeEntity,
} from "../projectIntentConversationShared.js";
import {
  joinFolderWithBasename,
} from "./projectIntentConversationHelpers.js";
import { resolveTargetObject } from "./projectIntentConversationTargetResolver.js";
import {
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
  replyOpenFileFromPath,
  replyExplainFileFromPath,
} from "./projectIntentConversationRepliesRuntime.js";

export async function handleOpenTargetIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  followupContext,
  pendingChoiceContext,
  latest,
  repo,
  branch,
  token,
}) {
  const rawTarget = sanitizeEntity(semanticPlan.targetPath || semanticPlan.targetEntity);

  const candidateFromFolder =
    followupContext?.isActive === true &&
    safeText(followupContext?.actionKind) === "browse_folder" &&
    /\.[a-z0-9]{1,8}$/i.test(rawTarget) &&
    !rawTarget.includes("/")
      ? joinFolderWithBasename(followupContext?.targetPath || followupContext?.treePrefix, rawTarget)
      : "";

  const matches = candidateFromFolder
    ? [candidateFromFolder]
    : await searchSnapshotPaths(
        latest.id,
        rawTarget,
        8,
        { objectKind: semanticPlan?.objectKind || "unknown" }
      );

  const resolved = await resolveTargetObject({
    latestSnapshotId: latest.id,
    semanticPlan: {
      ...semanticPlan,
      targetPath: candidateFromFolder || semanticPlan.targetPath,
    },
    followupContext,
    pendingChoiceContext,
    rawTarget,
    searchMatches: matches,
  });

  if (!resolved.ok) {
    await replyHuman(
      replyAndLog,
      humanClarificationReply("Нужен более точный объект репозитория: файл или папка."),
      { event: "repo_conversation_open_clarification" }
    );
    return { handled: true, reason: "open_clarification" };
  }

  if (resolved.objectKind === "folder") {
    return replyFolderBrowseFromPath({
      replyAndLog,
      folderPath: resolved.targetPath,
      targetEntity: semanticPlan.targetEntity || rawTarget,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "open_target",
      latestSnapshotId: latest.id,
      event: "repo_conversation_open_folder",
    });
  }

  if (resolved.objectKind === "file") {
    return replyOpenFileFromPath({
      replyAndLog,
      targetPath: resolved.targetPath,
      targetEntity: semanticPlan.targetEntity || rawTarget,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "open_target",
      repo,
      branch,
      token,
      event: "repo_conversation_open_file",
    });
  }

  await replyHuman(
    replyAndLog,
    `\`${resolved.targetPath}\` найден, но тип объекта определить не удалось.`,
    { event: "repo_conversation_open_unknown_kind" }
  );

  return { handled: true, reason: "open_unknown_kind" };
}

export async function handleExplainLikeIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  followupContext,
  pendingChoiceContext,
  latest,
  callAI,
  repo,
  branch,
  token,
}) {
  const effectiveDisplayMode =
    safeText(semanticPlan.displayMode) ||
    safeText(pendingChoiceContext?.displayMode) ||
    safeText(followupContext?.displayMode) ||
    "explain";

  const rawTarget = sanitizeEntity(semanticPlan.targetPath || semanticPlan.targetEntity);

  const candidateFromFolder =
    followupContext?.isActive === true &&
    safeText(followupContext?.actionKind) === "browse_folder" &&
    /\.[a-z0-9]{1,8}$/i.test(rawTarget) &&
    !rawTarget.includes("/")
      ? joinFolderWithBasename(followupContext?.targetPath || followupContext?.treePrefix, rawTarget)
      : "";

  const matches = candidateFromFolder
    ? [candidateFromFolder]
    : await searchSnapshotPaths(
        latest.id,
        rawTarget,
        8,
        { objectKind: semanticPlan?.objectKind || "unknown" }
      );

  const resolved = await resolveTargetObject({
    latestSnapshotId: latest.id,
    semanticPlan: {
      ...semanticPlan,
      targetPath: candidateFromFolder || semanticPlan.targetPath,
    },
    followupContext,
    pendingChoiceContext,
    rawTarget,
    searchMatches: matches,
  });

  if (!resolved.ok) {
    await replyHuman(
      replyAndLog,
      humanClarificationReply("Нужен более точный объект для объяснения: файл или папка."),
      { event: "repo_conversation_explain_clarification" }
    );
    return { handled: true, reason: "explain_clarification" };
  }

  if (resolved.objectKind === "folder") {
    return replyExplainFolderFromPath({
      replyAndLog,
      folderPath: resolved.targetPath,
      targetEntity:
        semanticPlan.targetEntity ||
        followupContext?.targetEntity ||
        pendingChoiceContext?.targetEntity ||
        rawTarget,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: semanticPlan.intent,
      latestSnapshotId: latest.id,
      event: "repo_conversation_explain_folder",
    });
  }

  if (resolved.objectKind === "file") {
    return replyExplainFileFromPath({
      replyAndLog,
      trimmed,
      targetPath: resolved.targetPath,
      targetEntity:
        semanticPlan.targetEntity ||
        followupContext?.targetEntity ||
        pendingChoiceContext?.targetEntity ||
        rawTarget,
      displayMode: effectiveDisplayMode,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: semanticPlan.intent,
      repo,
      branch,
      token,
      callAI,
      event: "repo_conversation_explain_ai",
      forceFirstPart: effectiveDisplayMode === "raw_first_part",
    });
  }

  await replyHuman(
    replyAndLog,
    `\`${resolved.targetPath}\` найден, но пока неясно, это файл или папка.`,
    { event: "repo_conversation_explain_unknown_kind" }
  );

  return { handled: true, reason: "explain_unknown_kind" };
}

export default {
  handleOpenTargetIntent,
  handleExplainLikeIntent,
};