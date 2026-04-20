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

function basenameNoExt(value = "") {
  const v = safeText(value).split("/").pop() || "";
  return v.replace(/\.[^.]+$/i, "");
}

function classifyChildName(name = "") {
  const n = basenameNoExt(name).toLowerCase();

  if (!n) return "";
  if (n.includes("config")) return "конфигурация";
  if (n.includes("state")) return "состояние";
  if (n.includes("store")) return "хранение данных или состояния";
  if (n.includes("normalizer") || n.includes("normalize")) return "нормализация данных";
  if (n.includes("validator") || n.includes("validate")) return "проверка данных";
  if (n.includes("parser") || n.includes("parse")) return "разбор входных данных";
  if (n.includes("service")) return "сервисная логика";
  if (n.includes("controller")) return "управляющая логика";
  if (n.includes("adapter")) return "адаптация между частями системы";
  if (n.includes("bridge")) return "связующий слой между частями системы";
  if (n.includes("client")) return "клиент для внешнего источника или сервиса";
  if (n.includes("repo")) return "слой доступа к данным";
  if (n.includes("memory")) return "память или хранение контекста";
  if (n.includes("handler")) return "обработка входящего события или действия";
  if (n.includes("router")) return "маршрутизация";
  if (n.includes("prompt")) return "правила или шаблон работы ИИ";
  if (n.includes("command")) return "обработка команд";
  if (n.includes("dispatch")) return "распределение действий по нужным обработчикам";
  return "";
}

function buildFolderMeaningFromChildren({ folderPath, directories, files, hiddenCount }) {
  const lines = [`\`${folderPath}\` — папка репозитория.`, ""];

  if (directories.length > 0) {
    lines.push("Верхние подпапки:");
    for (const dir of directories) {
      lines.push(`- ${dir}/`);
    }
    lines.push("");
  }

  if (files.length > 0) {
    lines.push("Верхние файлы:");
    for (const file of files) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  const fileHints = files
    .map((file) => ({
      file,
      hint: classifyChildName(file),
    }))
    .filter((item) => item.hint);

  if (fileHints.length > 0) {
    lines.push("По именам верхних файлов здесь видны такие роли:");
    for (const item of fileHints.slice(0, 6)) {
      lines.push(`- ${item.file} → ${item.hint}`);
    }
    lines.push("");
  }

  if (directories.length > 0 && fileHints.length > 0) {
    lines.push("По текущему верхнему уровню это похоже на модуль, где есть и внутренняя структура по подпапкам, и отдельные файлы реализации ключевых ролей.");
  } else if (directories.length > 0 && files.length > 0) {
    lines.push("По текущему верхнему уровню это похоже на модуль с несколькими уровнями структуры и набором основных файлов.");
  } else if (directories.length > 0) {
    lines.push("По текущему верхнему уровню это похоже на структурный раздел, где логика разнесена по подпапкам.");
  } else if (fileHints.length > 0) {
    lines.push("По текущему верхнему уровню это похоже на компактный модуль, где роли файлов читаются по их именам.");
  } else if (files.length > 0) {
    lines.push("По текущему верхнему уровню это похоже на компактный модуль без сильного дробления на подпапки.");
  } else {
    lines.push("По текущему снимку содержимого недостаточно для уверенного вывода о роли папки.");
  }

  if (hiddenCount > 0) {
    lines.push(`Глубже внутри есть ещё ${hiddenCount} элементов. Более точное объяснение даст открытие 1–2 ключевых файлов.`);
  }

  return lines.join("\n");
}

function looksLikeFileInnerQuestion(text = "") {
  const t = safeText(text).toLowerCase();
  if (!t) return false;

  return (
    t.includes("из этого файла") ||
    t.includes("в этом файле") ||
    t.includes("из файла") ||
    t.includes("внутри файла") ||
    t.includes("одну команд") ||
    t.includes("какую нибудь команд") ||
    t.includes("какую-нибудь команд") ||
    t.includes("про команд") ||
    t.includes("про функцию") ||
    t.includes("про метод") ||
    t.includes("про участок") ||
    t.includes("про часть") ||
    t.includes("расскажи про") ||
    t.includes("объясни команд") ||
    t.includes("объясни функцию") ||
    t.includes("что делает команд") ||
    t.includes("что делает функция")
  );
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
    safeText(packed.text) || "Объяснение не удалось сформировать достаточно надёжно.",
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

  const activeFileFollowup =
    followupContext?.isActive === true &&
    safeText(followupContext?.objectKind) === "file" &&
    looksLikeFileInnerQuestion(trimmed);

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
