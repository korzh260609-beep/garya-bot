// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — human-first repo conversation layer
// Orchestrator only
// Meaning → intent → decision → action → response
// ============================================================================

import { resolveProjectIntentSemanticPlan } from "./projectIntentSemanticResolver.js";
import {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  pathKindInSnapshot,
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
import {
  getReplyLimitFromReplyAndLog,
  buildPackedExplainText,
  buildContinuationChunkReply,
} from "./projectIntentResponsePacker.js";

export {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
};

const LARGE_DOC_AI_THRESHOLD = 12000;

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

function inferObjectKindFromPath(path = "") {
  const value = safeText(path);
  if (!value) return "unknown";
  if (/\.[a-z0-9]{1,8}$/i.test(value)) return "file";
  if (value.endsWith("/") || value.includes("/")) return "folder";
  return "unknown";
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
    safeText(packed.text) || "Я прочитал объект репозитория, но не смог нормально сформулировать объяснение.",
    {
      event,
      ...contextMeta,
    }
  );

  return contextMeta;
}

async function replyContinuation({
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
      "Продолжения больше нет. Могу заново кратко пересказать объект репозитория или объяснить его смысл.",
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

async function resolveTargetObject({
  latestSnapshotId,
  semanticPlan,
  followupContext,
  pendingChoiceContext,
  rawTarget,
  searchMatches,
}) {
  const targetPath = pickLikelyTargetPath({
    semanticPlan,
    searchMatches,
    followupContext,
    pendingChoiceContext,
  });

  if (!targetPath) {
    return {
      ok: false,
      targetPath: "",
      objectKind: "unknown",
      exists: false,
    };
  }

  const exists = await pathExistsInSnapshot(latestSnapshotId, targetPath);
  if (!exists) {
    return {
      ok: false,
      targetPath,
      objectKind: "unknown",
      exists: false,
    };
  }

  const snapshotKind = await pathKindInSnapshot(latestSnapshotId, targetPath);
  const objectKind =
    safeText(snapshotKind) ||
    safeText(semanticPlan?.objectKind) ||
    inferObjectKindFromPath(targetPath) ||
    inferObjectKindFromPath(rawTarget);

  return {
    ok: true,
    targetPath,
    objectKind: safeText(objectKind || "unknown"),
    exists: true,
  };
}

async function replyFolderBrowseFromPath({
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
      humanClarificationReply("Какую именно папку показать?"),
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
      `Я понял, что это папка \`${requestedFolder}\`, но в текущем снимке репозитория не нашёл у неё вложенных элементов.`,
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

async function replyExplainFolderFromPath({
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
      humanClarificationReply("Какую именно папку нужно объяснить?"),
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
      `Я понял, что нужно объяснить папку \`${requestedFolder}\`, но в текущем снимке не вижу у неё содержимого, по которому можно сделать надёжный вывод.`,
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

  const lines = [
    `Я понял, что \`${requestedFolder}\` — это папка репозитория.`,
    "",
  ];

  if (shownDirectories.length > 0) {
    lines.push("Верхние подпапки:");
    for (const dir of shownDirectories) {
      lines.push(`- ${dir}/`);
    }
    lines.push("");
  }

  if (shownFiles.length > 0) {
    lines.push("Верхние файлы:");
    for (const file of shownFiles) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  lines.push(
    "По смыслу эта папка отвечает за ту часть системы, которая выражена её содержимым и структурой."
  );

  if (shownDirectories.length > 0 && shownFiles.length > 0) {
    lines.push(
      "То есть здесь, похоже, собраны и вложенные части модуля, и конкретные файлы реализации этого направления."
    );
  } else if (shownDirectories.length > 0) {
    lines.push(
      "То есть здесь акцент больше на структурировании подмодулей, а не на одном-двух отдельных файлах."
    );
  } else if (shownFiles.length > 0) {
    lines.push(
      "То есть здесь акцент больше на наборе файлов реализации без сильного дробления на подпапки."
    );
  }

  if (hiddenCount > 0) {
    lines.push(
      `Глубже внутри есть ещё ${hiddenCount} элементов, поэтому для точного объяснения роли папки лучше открыть 1–2 ключевых файла или подпапки.`
    );
  } else {
    lines.push(
      "Текущего верхнего уровня уже достаточно, чтобы безопасно понимать её как отдельный объект структуры."
    );
  }

  lines.push("");
  lines.push("Дальше могу:");
  lines.push("- раскрыть эту папку");
  lines.push("- открыть один из файлов");
  lines.push("- объяснить конкретный файл внутри неё");

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

  await replyHuman(replyAndLog, lines.join("\n"), {
    event,
    ...contextMeta,
  });

  return {
    handled: true,
    reason: "explain_folder_human",
    contextMeta,
  };
}

async function replyOpenFileFromPath({
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
      `Я нашёл путь \`${targetPath}\`, но не смог прочитать содержимое файла.`,
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

async function replyExplainFileFromPath({
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
  event,
  forceFirstPart = false,
}) {
  const replyLimit = getReplyLimitFromReplyAndLog(replyAndLog);
  const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });

  if (!content) {
    await replyHuman(
      replyAndLog,
      `Я нашёл путь \`${targetPath}\`, но не смог прочитать сам файл.`,
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

  const aiReply = await callAIForExplain({
    trimmed,
    targetPath,
    content,
    displayMode,
    replyAndLog,
    semanticConfidence,
  });

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

async function callAIForExplain({
  trimmed,
  targetPath,
  content,
  displayMode,
  replyAndLog,
  semanticConfidence,
}) {
  void replyAndLog;
  void semanticConfidence;
  return globalThis.__projectIntentConversationServiceCallAI__(
    buildAiMessages({
      userText: trimmed,
      path: targetPath,
      content,
      displayMode,
    }),
    "high",
    {
      max_completion_tokens: 900,
      temperature: 0.35,
    }
  );
}

export async function runProjectIntentConversationFlow({
  trimmed,
  route,
  followupContext,
  pendingChoiceContext,
  replyAndLog,
  callAI,
}) {
  globalThis.__projectIntentConversationServiceCallAI__ = callAI;

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

    const text = humanSearchReply({
      targetEntity: query,
      matches,
    });

    const chosenPath = matches.length === 1 ? matches[0] : "";
    const chosenKind = chosenPath
      ? await pathKindInSnapshot(latest.id, chosenPath)
      : safeText(semanticPlan?.objectKind || "unknown");

    const contextMeta = buildRepoContextMeta({
      targetEntity: query,
      targetPath: chosenPath,
      displayMode: "raw",
      sourceText: trimmed,
      semanticConfidence: semanticPlan?.confidence,
      actionKind: "find_target",
    });

    contextMeta.projectIntentObjectKind = safeText(chosenKind || "unknown");

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
        event: "repo_conversation_find_and_explain_ai",
      });
    }

    await replyHuman(
      replyAndLog,
      `Я нашёл кандидат \`${resolved.targetPath}\`, но пока не смог надёжно определить, это файл или папка в текущем снимке репозитория.`,
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
        humanClarificationReply("Какой именно объект репозитория открыть: файл или папку?"),
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
      `Я нашёл путь \`${resolved.targetPath}\`, но пока не смог надёжно определить тип этого объекта.`,
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
        humanClarificationReply("Что именно нужно объяснить: файл или папку?"),
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
        event: "repo_conversation_explain_ai",
        forceFirstPart: effectiveDisplayMode === "raw_first_part",
      });
    }

    await replyHuman(
      replyAndLog,
      `Я нашёл путь \`${resolved.targetPath}\`, но пока не смог надёжно определить, это файл или папка.`,
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
