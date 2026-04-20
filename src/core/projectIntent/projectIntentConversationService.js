// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — human-first repo conversation layer
// Orchestrator only
// Meaning → intent → decision → action → response
// ============================================================================

import { resolveProjectIntentSemanticPlan } from "./projectIntentSemanticResolver.js";
import {
  loadLatestSnapshot,
  pathKindInSnapshot,
  fetchPathsByPrefix,
  computeImmediateChildren,
  searchSnapshotPaths,
} from "./projectIntentConversationRepoStore.js";
import {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanClarificationReply,
  replyHuman,
  buildRepoContextMeta,
} from "./projectIntentConversationReplies.js";
import {
  safeText,
  normalizePath,
  sanitizeEntity,
} from "./projectIntentConversationShared.js";
import {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
} from "./conversation/projectIntentConversationExports.js";
import {
  joinFolderWithBasename,
  basenameNoExt,
  normalizeFolderPrefix,
  shouldForceActiveFileExplain,
} from "./conversation/projectIntentConversationHelpers.js";
import { resolveTargetObject } from "./conversation/projectIntentConversationTargetResolver.js";
import {
  replyContinuation,
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
  replyOpenFileFromPath,
  replyExplainFileFromPath,
} from "./conversation/projectIntentConversationRepliesRuntime.js";

export {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
};

export async function runProjectIntentConversationFlow({
  trimmed,
  route,
  followupContext,
  pendingChoiceContext,
  replyAndLog,
  callAI,
}) {
  if (route?.routeKey !== "sg_core_internal_read_allowed") {
    return { handled: false, reason: "not_internal_repo_read" };
  }

  const snapshotState = await loadLatestSnapshot();
  if (!snapshotState.ok || !snapshotState.latest) {
    await replyHuman(
      replyAndLog,
      "Индекс репозитория пока не готов. Нужен актуальный снимок репозитория.",
      {
        event: "repo_conversation_no_snapshot",
      }
    );
    return { handled: true, reason: "no_snapshot" };
  }

  const latest = snapshotState.latest;
  const repo = snapshotState.repo;
  const branch = snapshotState.branch;
  const token = process.env.GITHUB_TOKEN;

  const semanticPlan = await resolveProjectIntentSemanticPlan({
    text: trimmed,
    callAI,
    followupContext,
    pendingChoiceContext,
  });

  const activeFileFollowup = shouldForceActiveFileExplain({
    trimmed,
    followupContext,
    semanticPlan,
  });

  if (activeFileFollowup) {
    return replyExplainFileFromPath({
      replyAndLog,
      trimmed,
      targetPath: followupContext?.targetPath,
      targetEntity: followupContext?.targetEntity || basenameNoExt(followupContext?.targetPath),
      displayMode: safeText(followupContext?.displayMode) || "explain",
      sourceText: trimmed,
      semanticConfidence: "high",
      actionKind: "explain_active",
      repo,
      branch,
      token,
      callAI,
      event: "repo_conversation_explain_active_file_followup",
    });
  }

  if (semanticPlan?.clarifyNeeded === true) {
    const text = humanClarificationReply(semanticPlan?.clarifyQuestion);
    const contextMeta = buildRepoContextMeta({
      targetEntity: semanticPlan?.targetEntity,
      targetPath: semanticPlan?.targetPath,
      displayMode: semanticPlan?.displayMode,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: semanticPlan?.intent,
    });

    contextMeta.projectIntentObjectKind = safeText(semanticPlan?.objectKind);

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_clarification",
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "clarification_replied",
      contextMeta,
    };
  }

  if (semanticPlan.intent === "continue_active") {
    return replyContinuation({
      replyAndLog,
      followupContext,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "continue_active",
      event: "repo_conversation_continue_active",
    });
  }

  if (semanticPlan.intent === "repo_status") {
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
    });

    contextMeta.projectIntentObjectKind = "repo";

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

  if (semanticPlan.intent === "show_tree") {
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
    });

    contextMeta.projectIntentObjectKind = prefix ? "folder" : "root";

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

  if (semanticPlan.intent === "browse_folder") {
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
    });
  }

  if (semanticPlan.intent === "find_target") {
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
    });

    contextMeta.projectIntentObjectKind = safeText(singleKind || "unknown");

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

  if (semanticPlan.intent === "find_and_explain") {
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
      });

      contextMeta.projectIntentObjectKind = safeText(resolved.objectKind || semanticPlan?.objectKind || "unknown");

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
      });
    }

    if (resolved.objectKind === "file") {
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

  if (semanticPlan.intent === "open_target") {
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

  if (
    semanticPlan.intent === "explain_target" ||
    semanticPlan.intent === "explain_active" ||
    semanticPlan.intent === "answer_pending_choice"
  ) {
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

  return {
    handled: false,
    reason: "conversation_layer_skipped",
  };
}

export default {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
  runProjectIntentConversationFlow,
};