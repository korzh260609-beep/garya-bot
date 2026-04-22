// src/core/projectIntent/conversation/projectIntentConversationRepoActions.js

import {
  pathKindInSnapshot,
  fetchPathsByPrefix,
  computeImmediateChildren,
  searchSnapshotPaths,
} from "../projectIntentConversationRepoStore.js";
import {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  replyHuman,
  buildRepoContextMeta,
} from "../projectIntentConversationReplies.js";
import {
  safeText,
  normalizePath,
  sanitizeEntity,
} from "../projectIntentConversationShared.js";
import { normalizeFolderPrefix } from "./projectIntentConversationHelpers.js";
import {
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
} from "./projectIntentConversationRepliesRuntime.js";
import { resolveTargetObject } from "./projectIntentConversationTargetResolver.js";

function pickProjectContextScope(...candidates) {
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      Object.keys(candidate).length > 0
    ) {
      return candidate;
    }
  }

  return {};
}

export async function handleRepoStatusIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  latest,
  snapshotState,
}) {
  const text = humanRepoStatusReply({
    snapshot: latest,
    filesCount: snapshotState.filesCount,
  });

  const contextMeta = buildRepoContextMeta({
    targetEntity: "",
    targetPath: "",
    displayMode: "raw",
    sourceText: trimmed,
    semanticConfidence: semanticPlan?.confidence,
    actionKind: "repo_status",
    objectKind: "repo",
    projectContextScope: pickProjectContextScope(
      semanticPlan?.projectContextScope
    ),
  });

  await replyHuman(replyAndLog, text, {
    event: "repo_conversation_status",
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "repo_status_human",
    contextMeta,
  };
}

export async function handleShowTreeIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  followupContext,
  latest,
}) {
  const prefix = normalizePath(semanticPlan.treePrefix || followupContext?.treePrefix || "");
  const allPaths = await fetchPathsByPrefix(latest.id, prefix);
  const { directories, files } = computeImmediateChildren(allPaths, prefix);

  const shownDirectories = directories.slice(0, 20);
  const shownFiles = files.slice(0, 20);
  const hiddenCount =
    Math.max(0, directories.length - shownDirectories.length) +
    Math.max(0, files.length - shownFiles.length);

  const text = humanTreeReply({
    prefix,
    directories: shownDirectories,
    files: shownFiles,
    hiddenCount,
  });

  const contextMeta = buildRepoContextMeta({
    targetEntity: "",
    targetPath: prefix,
    displayMode: "raw",
    sourceText: trimmed,
    treePrefix: prefix,
    semanticConfidence: semanticPlan?.confidence,
    actionKind: "show_tree",
    objectKind: prefix ? "folder" : "root",
    projectContextScope: pickProjectContextScope(
      semanticPlan?.projectContextScope,
      followupContext?.projectContextScope
    ),
  });

  await replyHuman(replyAndLog, text, {
    event: "repo_conversation_tree",
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "repo_tree_human",
    contextMeta,
  };
}

export async function handleBrowseFolderIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  followupContext,
  latest,
}) {
  const requestedFolder = normalizeFolderPrefix(
    safeText(semanticPlan?.targetPath || semanticPlan?.treePrefix || semanticPlan?.targetEntity) ||
    safeText(followupContext?.targetPath || followupContext?.treePrefix)
  );

  return replyFolderBrowseFromPath({
    replyAndLog,
    folderPath: requestedFolder,
    targetEntity: semanticPlan?.targetEntity || followupContext?.targetEntity,
    sourceText: trimmed,
    semanticConfidence: semanticPlan?.confidence,
    actionKind: "browse_folder",
    latestSnapshotId: latest.id,
    event: "repo_conversation_browse_folder",
    projectContextScope: pickProjectContextScope(
      semanticPlan?.projectContextScope,
      followupContext?.projectContextScope
    ),
  });
}

export async function handleFindTargetIntent({
  replyAndLog,
  trimmed,
  semanticPlan,
  followupContext,
  latest,
}) {
  const query = sanitizeEntity(semanticPlan.targetEntity || semanticPlan.targetPath);
  const matches = await searchSnapshotPaths(
    latest.id,
    query,
    8,
    { objectKind: semanticPlan?.objectKind || "unknown" }
  );

  const singleKind =
    matches.length === 1
      ? await pathKindInSnapshot(latest.id, matches[0])
      : safeText(semanticPlan?.objectKind || "unknown");

  const text = humanSearchReply({
    targetEntity: query,
    matches,
    objectKind: singleKind,
  });

  const chosenPath = matches.length === 1 ? matches[0] : "";

  const contextMeta = buildRepoContextMeta({
    targetEntity: query,
    targetPath: chosenPath,
    displayMode: "raw",
    sourceText: trimmed,
    semanticConfidence: semanticPlan?.confidence,
    actionKind: "find_target",
    objectKind: safeText(singleKind || "unknown"),
    projectContextScope: pickProjectContextScope(
      semanticPlan?.projectContextScope,
      followupContext?.projectContextScope
    ),
  });

  await replyHuman(replyAndLog, text, {
    event: "repo_conversation_search",
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "repo_search_human",
    contextMeta,
  };
}

export async function handleFindAndExplainIntent({
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
  const query = sanitizeEntity(semanticPlan.targetEntity || semanticPlan.targetPath);
  const matches = await searchSnapshotPaths(
    latest.id,
    query,
    8,
    { objectKind: semanticPlan?.objectKind || "unknown" }
  );

  const resolved = await resolveTargetObject({
    latestSnapshotId: latest.id,
    semanticPlan,
    followupContext,
    pendingChoiceContext,
    rawTarget: query,
    searchMatches: matches,
  });

  if (!resolved.ok) {
    const text = humanSearchReply({
      targetEntity: query,
      matches,
      objectKind: safeText(semanticPlan?.objectKind || "unknown"),
    });

    const contextMeta = buildRepoContextMeta({
      targetEntity: query,
      targetPath: resolved.targetPath || "",
      displayMode: semanticPlan.displayMode || "summary",
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_and_explain",
      objectKind: safeText(
        resolved.objectKind || semanticPlan?.objectKind || "unknown"
      ),
      projectContextScope: pickProjectContextScope(
        semanticPlan?.projectContextScope,
        followupContext?.projectContextScope
      ),
    });

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_find_and_explain_search_only",
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "find_and_explain_search_only",
      contextMeta,
    };
  }

  if (resolved.objectKind === "folder") {
    return replyExplainFolderFromPath({
      replyAndLog,
      folderPath: resolved.targetPath,
      targetEntity: query,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_and_explain",
      latestSnapshotId: latest.id,
      event: "repo_conversation_find_and_explain_folder",
      projectContextScope: pickProjectContextScope(
        semanticPlan?.projectContextScope,
        followupContext?.projectContextScope
      ),
    });
  }

  if (resolved.objectKind === "file") {
    const { replyExplainFileFromPath } = await import("./projectIntentConversationRepliesRuntime.js");
    return replyExplainFileFromPath({
      replyAndLog,
      trimmed,
      targetPath: resolved.targetPath,
      targetEntity: query,
      displayMode: semanticPlan.displayMode || "summary",
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_and_explain",
      repo,
      branch,
      token,
      callAI,
      event: "repo_conversation_find_and_explain_ai",
      projectContextScope: pickProjectContextScope(
        semanticPlan?.projectContextScope,
        followupContext?.projectContextScope
      ),
    });
  }

  await replyHuman(
    replyAndLog,
    `\`${resolved.targetPath}\` найден, но тип объекта пока не определён надёжно.`,
    { event: "repo_conversation_find_and_explain_unknown_kind" }
  );

  return {
    handled: true,
    reason: "find_and_explain_unknown_kind",
  };
}

export default {
  handleRepoStatusIntent,
  handleShowTreeIntent,
  handleBrowseFolderIntent,
  handleFindTargetIntent,
  handleFindAndExplainIntent,
};