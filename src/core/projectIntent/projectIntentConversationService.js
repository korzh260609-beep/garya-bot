// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — human-first repo conversation layer
// Orchestrator only
// ============================================================================

import { resolveProjectIntentSemanticPlan } from "./projectIntentSemanticResolver.js";
import {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  fetchPathsByPrefix,
  computeImmediateChildren,
  searchSnapshotPaths,
  fetchRepoFileText,
  pickLikelyTargetPath,
} from "./projectIntentConversationRepoStore.js";
import {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
  buildAiMessages,
  replyHuman,
  buildRepoContextMeta,
} from "./projectIntentConversationReplies.js";
import {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
} from "./projectIntentConversationContext.js";
import {
  safeText,
  normalizePath,
  sanitizeEntity,
} from "./projectIntentConversationShared.js";

export {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
};

const DEFAULT_TRANSPORT_REPLY_LIMIT = 3200;
const TRANSPORT_REPLY_LIMITS = Object.freeze({
  telegram: 3200,
  discord: 3500,
  web: 6000,
  api: 8000,
  unknown: DEFAULT_TRANSPORT_REPLY_LIMIT,
});

function getReplyLimitFromMeta(replyAndLog) {
  const transportName = safeText(replyAndLog?.transport || replyAndLog?.transportName).toLowerCase();
  if (transportName && TRANSPORT_REPLY_LIMITS[transportName]) {
    return TRANSPORT_REPLY_LIMITS[transportName];
  }
  return DEFAULT_TRANSPORT_REPLY_LIMIT;
}

function normalizeFolderPrefix(value = "") {
  const v = normalizePath(value);
  if (!v) return "";
  if (v.endsWith("/")) return v;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return v;
  return `${v}/`;
}

function joinFolderWithBasename(folderPath = "", basename = "") {
  const folder = normalizeFolderPrefix(folderPath);
  const file = safeText(basename).replace(/^\/+/, "");
  if (!folder || !file) return "";
  return `${folder}${file}`;
}

function isLikelySentenceBoundaryChar(ch = "") {
  return [".", "!", "?", "…"].includes(ch);
}

function cutAtSemanticBoundary(text = "", limit = DEFAULT_TRANSPORT_REPLY_LIMIT) {
  const raw = safeText(text);
  if (!raw) {
    return {
      head: "",
      tail: "",
      wasSplit: false,
      endedCleanly: true,
    };
  }

  if (raw.length <= limit) {
    return {
      head: raw,
      tail: "",
      wasSplit: false,
      endedCleanly: true,
    };
  }

  const slice = raw.slice(0, limit);

  let bestIndex = -1;

  for (let i = slice.length - 1; i >= Math.floor(limit * 0.55); i -= 1) {
    const ch = slice[i];
    const next = slice[i + 1] || "";

    if (isLikelySentenceBoundaryChar(ch) && (next === " " || next === "\n" || next === "")) {
      bestIndex = i + 1;
      break;
    }

    if (ch === "\n" && slice[i - 1] === "\n") {
      bestIndex = i + 1;
      break;
    }
  }

  if (bestIndex === -1) {
    for (let i = slice.length - 1; i >= Math.floor(limit * 0.7); i -= 1) {
      if (slice[i] === " ") {
        bestIndex = i;
        break;
      }
    }
  }

  if (bestIndex === -1) {
    bestIndex = limit;
  }

  const head = slice.slice(0, bestIndex).trim();
  const tail = raw.slice(bestIndex).trim();

  return {
    head,
    tail,
    wasSplit: true,
    endedCleanly: /[.!?…]$/.test(head),
  };
}

function buildExplainDeliveryPlan({
  aiReply,
  targetPath,
  displayMode,
  replyLimit,
}) {
  const text = safeText(aiReply);

  const split = cutAtSemanticBoundary(text, replyLimit);

  if (!split.wasSplit) {
    return {
      text,
      largeDocument: false,
      pendingChoice: null,
    };
  }

  const name = safeText(targetPath).split("/").pop() || safeText(targetPath) || "документ";

  const intro =
    displayMode === "summary"
      ? `Я даю первую часть краткого объяснения файла ${name}.`
      : `Я даю первую часть объяснения файла ${name}.`;

  const statusBlock = split.endedCleanly
    ? [
        "",
        "Ответ длиннее одного сообщения.",
        "Есть продолжение.",
        "Напиши: `продолжай` или `покажи следующую часть`.",
      ].join("\n")
    : [
        "",
        "Ответ пришлось остановить на границе допустимого объёма.",
        "Есть продолжение.",
        "Напиши: `продолжай` или `покажи следующую часть`.",
      ].join("\n");

  return {
    text: [intro, "", split.head, statusBlock].join("\n"),
    largeDocument: true,
    pendingChoice: {
      isActive: true,
      kind: "large_doc_action",
      targetEntity: name,
      targetPath: safeText(targetPath),
      displayMode,
    },
  };
}

async function replyPackedExplain({
  replyAndLog,
  aiReply,
  targetEntity,
  targetPath,
  displayMode,
  sourceText,
  semanticConfidence,
  actionKind,
  event,
}) {
  const replyLimit = getReplyLimitFromMeta(replyAndLog);

  const plan = buildExplainDeliveryPlan({
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
    largeDocument: plan.largeDocument === true,
    pendingChoice: plan.pendingChoice,
    semanticConfidence,
    actionKind,
  });

  await replyHuman(
    replyAndLog,
    safeText(plan.text) || "Я прочитал документ, но не смог нормально сформулировать объяснение.",
    {
      event,
      ...contextMeta,
    }
  );

  return contextMeta;
}

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
      "Я пока не могу читать репозиторий, потому что индекс ещё не подготовлен. Сначала нужен актуальный снимок репозитория.",
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
  const replyLimit = getReplyLimitFromMeta(replyAndLog);

  const semanticPlan = await resolveProjectIntentSemanticPlan({
    text: trimmed,
    callAI,
    followupContext,
    pendingChoiceContext,
  });

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
      targetPath: "",
      displayMode: "raw",
      sourceText: trimmed,
      treePrefix: prefix,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "show_tree",
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

  if (semanticPlan.intent === "browse_folder") {
    const requestedFolder = normalizeFolderPrefix(
      semanticPlan.targetPath ||
      semanticPlan.treePrefix ||
      followupContext?.targetPath ||
      followupContext?.treePrefix ||
      semanticPlan.targetEntity
    );

    if (!requestedFolder) {
      await replyHuman(
        replyAndLog,
        humanClarificationReply("Какую именно папку показать?"),
        { event: "repo_conversation_browse_folder_clarification" }
      );
      return { handled: true, reason: "browse_folder_clarification" };
    }

    const allPaths = await fetchPathsByPrefix(latest.id, requestedFolder);
    const { directories, files } = computeImmediateChildren(allPaths, requestedFolder);

    if (directories.length === 0 && files.length === 0) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно показать содержимое папки \`${requestedFolder}\`, но в текущем снимке репозитория не нашёл у неё вложенных элементов.`,
        {
          event: "repo_conversation_browse_folder_empty",
          read_only: true,
        }
      );

      return {
        handled: true,
        reason: "browse_folder_empty",
        contextMeta: buildRepoContextMeta({
          targetEntity: semanticPlan?.targetEntity || followupContext?.targetEntity,
          targetPath: requestedFolder,
          displayMode: "raw",
          sourceText: trimmed,
          treePrefix: requestedFolder,
          semanticConfidence: semanticPlan?.confidence,
          actionKind: "browse_folder",
        }),
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
      targetEntity: semanticPlan?.targetEntity || followupContext?.targetEntity,
      targetPath: requestedFolder,
      displayMode: "raw",
      sourceText: trimmed,
      treePrefix: requestedFolder,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "browse_folder",
    });

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_browse_folder",
      ...contextMeta,
    });

    return {
      handled: true,
      reason: "browse_folder_human",
      contextMeta,
    };
  }

  if (semanticPlan.intent === "find_target") {
    const query = sanitizeEntity(semanticPlan.targetEntity || semanticPlan.targetPath);
    const matches = await searchSnapshotPaths(latest.id, query, 8);

    const text = humanSearchReply({
      targetEntity: query,
      matches,
    });

    const contextMeta = buildRepoContextMeta({
      targetEntity: query,
      targetPath: matches.length === 1 ? matches[0] : "",
      displayMode: "raw",
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_target",
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

  if (semanticPlan.intent === "find_and_explain") {
    const query = sanitizeEntity(semanticPlan.targetEntity || semanticPlan.targetPath);
    const matches = await searchSnapshotPaths(latest.id, query, 8);

    const targetPath = pickLikelyTargetPath({
      semanticPlan,
      searchMatches: matches,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      const text = humanSearchReply({
        targetEntity: query,
        matches,
      });

      const contextMeta = buildRepoContextMeta({
        targetEntity: query,
        targetPath: "",
        displayMode: semanticPlan.displayMode || "summary",
        sourceText: trimmed,
        semanticConfidence: semanticPlan?.confidence,
        actionKind: "find_and_explain",
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

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно найти и объяснить "${query || targetPath}", но не смог безопасно подтвердить этот путь в текущем индексе репозитория.`,
        { event: "repo_conversation_find_and_explain_missing" }
      );

      return {
        handled: true,
        reason: "find_and_explain_missing",
      };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл файл \`${targetPath}\`, но не смог прочитать его содержимое.`,
        { event: "repo_conversation_find_and_explain_fetch_failed" }
      );
      return {
        handled: true,
        reason: "find_and_explain_fetch_failed",
      };
    }

    if (content.length > 12000) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: query,
        targetPath,
        displayMode: semanticPlan.displayMode || "summary",
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: query,
          targetPath,
          displayMode: semanticPlan.displayMode || "summary",
        },
        semanticConfidence: semanticPlan?.confidence,
        actionKind: "find_and_explain",
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_find_and_explain_large_doc",
        ...contextMeta,
      });

      return {
        handled: true,
        reason: "find_and_explain_large_doc",
        contextMeta,
      };
    }

    const aiReply = await callAI(
      buildAiMessages({
        userText: trimmed,
        path: targetPath,
        content,
        displayMode: semanticPlan.displayMode || "summary",
      }),
      "high",
      {
        max_completion_tokens: 550,
        temperature: 0.35,
      }
    );

    const contextMeta = await replyPackedExplain({
      replyAndLog,
      aiReply,
      targetEntity: query,
      targetPath,
      displayMode: semanticPlan.displayMode || "summary",
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_and_explain",
      event: "repo_conversation_find_and_explain_ai",
    });

    return {
      handled: true,
      reason: "find_and_explain_ai",
      contextMeta,
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
      : await searchSnapshotPaths(latest.id, rawTarget, 8);

    const targetPath = pickLikelyTargetPath({
      semanticPlan: {
        ...semanticPlan,
        targetPath: candidateFromFolder || semanticPlan.targetPath,
      },
      searchMatches: matches,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      await replyHuman(
        replyAndLog,
        humanClarificationReply("Какой именно файл или документ открыть?"),
        { event: "repo_conversation_open_clarification" }
      );
      return { handled: true, reason: "open_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, какой файл ты имеешь в виду, но не нашёл его в текущем индексе репозитория: \`${targetPath}\`.`,
        { event: "repo_conversation_open_missing" }
      );
      return { handled: true, reason: "open_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать содержимое файла.`,
        { event: "repo_conversation_open_fetch_failed" }
      );
      return { handled: true, reason: "open_fetch_failed" };
    }

    if (content.length > replyLimit) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity,
        targetPath,
        displayMode: "raw",
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: semanticPlan.targetEntity,
          targetPath,
          displayMode: "summary",
        },
        semanticConfidence: semanticPlan?.confidence,
        actionKind: "open_target",
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_open_large_doc",
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
      targetEntity: semanticPlan.targetEntity,
      targetPath,
      displayMode: "raw",
      sourceText: trimmed,
      largeDocument: false,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "open_target",
    });

    await replyHuman(
      replyAndLog,
      humanSmallDocumentReply({
        path: targetPath,
        content: preview,
        wasTrimmed: content.length > replyLimit,
      }),
      {
        event: "repo_conversation_open_small_doc",
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "open_small_doc",
      contextMeta,
    };
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
      : await searchSnapshotPaths(latest.id, rawTarget, 8);

    const targetPath = pickLikelyTargetPath({
      semanticPlan: {
        ...semanticPlan,
        targetPath: candidateFromFolder || semanticPlan.targetPath,
      },
      searchMatches: matches,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      await replyHuman(
        replyAndLog,
        humanClarificationReply("Что именно нужно объяснить?"),
        { event: "repo_conversation_explain_clarification" }
      );
      return { handled: true, reason: "explain_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно объяснить файл \`${targetPath}\`, но не нашёл его в текущем индексе репозитория.`,
        { event: "repo_conversation_explain_missing" }
      );
      return { handled: true, reason: "explain_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать сам файл.`,
        { event: "repo_conversation_explain_fetch_failed" }
      );
      return { handled: true, reason: "explain_fetch_failed" };
    }

    if (effectiveDisplayMode === "raw_first_part") {
      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
        targetPath,
        displayMode: effectiveDisplayMode,
        sourceText: trimmed,
        largeDocument: content.length > replyLimit,
        semanticConfidence: semanticPlan?.confidence,
        actionKind: semanticPlan.intent,
      });

      await replyHuman(
        replyAndLog,
        humanFirstPartDocumentReply({
          path: targetPath,
          content,
          maxChars: replyLimit,
        }),
        {
          event: "repo_conversation_first_part",
          ...contextMeta,
        }
      );

      return {
        handled: true,
        reason: "first_part_shown",
        contextMeta,
      };
    }

    if (content.length > 12000) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
        targetPath,
        displayMode: effectiveDisplayMode,
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
          targetPath,
          displayMode: effectiveDisplayMode,
        },
        semanticConfidence: semanticPlan?.confidence,
        actionKind: semanticPlan.intent,
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_explain_large_doc",
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
        displayMode: effectiveDisplayMode,
      }),
      "high",
      {
        max_completion_tokens: 550,
        temperature: 0.35,
      }
    );

    const contextMeta = await replyPackedExplain({
      replyAndLog,
      aiReply,
      targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
      targetPath,
      displayMode: effectiveDisplayMode,
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: semanticPlan.intent,
      event: "repo_conversation_explain_ai",
    });

    return {
      handled: true,
      reason: "explain_ai",
      contextMeta,
    };
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
