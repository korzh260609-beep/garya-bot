// src/core/projectIntent/projectIntentConversationReplies.js

import { safeText } from "./projectIntentConversationShared.js";

function formatObjectLabel(path = "", objectKind = "unknown") {
  const p = safeText(path);
  if (!p) return "Объект репозитория.";
  if (objectKind === "folder") return `\`${p}\` — папка репозитория.`;
  if (objectKind === "file") return `\`${p}\` — файл репозитория.`;
  if (objectKind === "root") return "Корень репозитория.";
  if (objectKind === "repo") return "Репозиторий проекта.";
  return `\`${p}\` — объект репозитория.`;
}

export function humanRepoStatusReply({ snapshot, filesCount }) {
  return [
    "Репозиторий доступен в режиме только чтения.",
    `Актуальный снимок: ${safeText(snapshot?.repo)} / ветка ${safeText(snapshot?.branch)}.`,
    `В индексе примерно ${filesCount} файлов.`,
    "Доступны действия: показать корень, раскрыть папку, найти объект, открыть файл, кратко пересказать или объяснить смысл.",
  ].join("\n");
}

export function humanSearchReply({ targetEntity, matches, objectKind = "unknown" }) {
  const target = safeText(targetEntity) || "нужный объект";

  if (!Array.isArray(matches) || matches.length === 0) {
    return `Для запроса "${target}" совпадений не найдено. Нужен более точный путь, имя файла или смысловой ориентир.`;
  }

  if (matches.length === 1) {
    const only = safeText(matches[0]);
    const label =
      objectKind === "folder"
        ? `\`${only}\` — папка репозитория.`
        : objectKind === "file"
          ? `\`${only}\` — файл репозитория.`
          : `\`${only}\` — найденный объект репозитория.`;

    return [
      label,
      "Дальше можно открыть, раскрыть, кратко пересказать или объяснить смысл.",
    ].join("\n");
  }

  const lines = matches.slice(0, 6).map((path) => `- \`${path}\``);
  return [
    `Для запроса "${target}" найдено несколько совпадений:`,
    ...lines,
    "",
    "Нужен выбор одного варианта: например, «открой первый», «объясни второй», «раскрой третий».",
  ].join("\n");
}

export function humanTreeReply({ prefix, directories, files, hiddenCount }) {
  const isRoot = !safeText(prefix);
  const lines = [isRoot ? "Корень репозитория." : `\`${safeText(prefix)}\` — верхний уровень папки.`];

  if (directories.length > 0) {
    lines.push("");
    lines.push("Папки:");
    for (const dir of directories) {
      lines.push(`- ${dir}/`);
    }
  }

  if (files.length > 0) {
    lines.push("");
    lines.push("Файлы:");
    for (const file of files) {
      lines.push(`- ${file}`);
    }
  }

  lines.push("");
  if (hiddenCount > 0) {
    lines.push(`Показан только верхний уровень. Глубже внутри есть ещё ${hiddenCount} элементов.`);
  } else {
    lines.push("Показан только верхний уровень без углубления дальше.");
  }

  lines.push("Дальше можно раскрыть конкретную папку или открыть нужный файл.");

  return lines.join("\n");
}

export function humanFolderBrowseReply({ folderPath, directories, files, hiddenCount }) {
  const folder = safeText(folderPath) || "/";
  const lines = [`\`${folder}\` — папка репозитория.`];

  if (directories.length > 0) {
    lines.push("");
    lines.push("Подпапки:");
    for (const dir of directories) {
      lines.push(`- ${dir}/`);
    }
  }

  if (files.length > 0) {
    lines.push("");
    lines.push("Файлы:");
    for (const file of files) {
      lines.push(`- ${file}`);
    }
  }

  if (directories.length === 0 && files.length === 0) {
    lines.push("");
    lines.push("На верхнем уровне элементов не видно.");
  }

  lines.push("");
  if (hiddenCount > 0) {
    lines.push(`Показано только прямое содержимое. Глубже внутри есть ещё ${hiddenCount} элементов.`);
  } else {
    lines.push("Показано только прямое содержимое без углубления дальше.");
  }

  lines.push("Дальше можно раскрыть подпапку, открыть файл или объяснить конкретный объект внутри.");

  return lines.join("\n");
}

export function humanLargeDocumentReply({ path }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "документ";
  return [
    `\`${name}\` — большой файл.`,
    "Полный вывод целиком сейчас не нужен.",
    "Варианты:",
    "- краткое содержание",
    "- объяснение простыми словами",
    "- первая часть",
    "- перевод на русский",
    "- разбор конкретного раздела",
  ].join("\n");
}

export function humanSmallDocumentReply({ path, content, wasTrimmed }) {
  const lines = [formatObjectLabel(path, "file")];

  if (wasTrimmed) {
    lines.push("Показана первая часть. Дальше можно продолжить, кратко пересказать или объяснить смысл.");
  }

  lines.push("");
  lines.push("```");
  lines.push(content);
  lines.push("```");

  return lines.join("\n");
}

export function humanFirstPartDocumentReply({ path, content, maxChars = 2600 }) {
  const preview = safeText(content).slice(0, maxChars);

  return [
    formatObjectLabel(path, "file"),
    "",
    "```",
    preview,
    "```",
    "",
    "Дальше можно показать продолжение, кратко пересказать или объяснить смысл.",
  ].join("\n");
}

export function humanClarificationReply(question) {
  return safeText(question) || "Нужно уточнение по объекту или действию внутри репозитория.";
}

export function buildAiMessages({
  userText,
  path,
  content,
  displayMode,
}) {
  let taskInstruction = "Объясни смысл документа простым человеческим языком.";

  if (displayMode === "translate_ru") {
    taskInstruction = "Переведи и объясни содержание на русском языке простыми словами.";
  } else if (displayMode === "summary") {
    taskInstruction = "Сделай короткое и понятное summary простыми словами.";
  } else if (displayMode === "explain") {
    taskInstruction = "Объясни смысл документа простым человеческим языком.";
  }

  return [
    {
      role: "system",
      content:
        "Ты — SG, помощник по репозиторию проекта.\n" +
        "Отвечай по логике и смыслу, без шаблонных фраз о себе.\n" +
        "Не используй самонарратив вроде: «я понял», «я нашёл», «я показал», «я специально».\n" +
        "Начинай ответ сразу с факта, объекта, роли и смысла.\n" +
        "Опирайся только на текст файла.\n" +
        "Запрещено делать выводы только по имени файла, имени папки или ассоциациям со словами в названии.\n" +
        "Если содержимое файла не подтверждает вывод, так и скажи.\n" +
        "Нельзя придумывать назначение файла по названию.\n" +
        "Нельзя просить прислать текст файла, потому что он уже передан.\n" +
        "Не упоминай route, handler, bridge, snapshotId и другую внутреннюю техничку, если этого нет в тексте файла как сути.\n" +
        "Если ответ длинный, первая часть должна быть смыслово законченной.\n" +
        "Нельзя обрывать ответ на полуслове.\n" +
        "Если файл описывает проект или модуль, объясняй именно его реальную роль по содержимому.\n" +
        "Если файл — код, объясняй только то, что можно надёжно вывести из кода, структуры экспортов, функций, параметров, состояний и комментариев.\n" +
        "Если уверенность низкая, прямо скажи, что вывод ограничен видимым содержимым файла.",
    },
    {
      role: "user",
      content:
        `Запрос пользователя:\n${safeText(userText)}\n\n` +
        `Путь файла:\n${safeText(path)}\n\n` +
        `Задача:\n${taskInstruction}\n\n` +
        `Текст файла:\n<<<FILE_START>>>\n${content}\n<<<FILE_END>>>`,
    },
  ];
}

export async function replyHuman(replyAndLog, text, meta = {}) {
  if (typeof replyAndLog !== "function") return;
  await replyAndLog(text, {
    read_only: true,
    ...meta,
  });
}

export function buildRepoContextMeta({
  targetEntity,
  targetPath,
  displayMode,
  sourceText,
  largeDocument = false,
  pendingChoice = null,
  treePrefix = "",
  semanticConfidence = "low",
  actionKind = "",
  continuationState = null,
}) {
  const chunks = Array.isArray(continuationState?.chunks)
    ? continuationState.chunks.filter(Boolean)
    : [];

  return {
    projectIntentRepoContextActive: true,
    projectIntentTargetEntity: safeText(targetEntity),
    projectIntentTargetPath: safeText(targetPath),
    projectIntentDisplayMode: safeText(displayMode),
    projectIntentSourceText: safeText(sourceText),
    projectIntentLargeDocument: largeDocument === true,
    projectIntentTreePrefix: safeText(treePrefix),
    projectIntentSemanticConfidence: safeText(semanticConfidence),
    projectIntentActionKind: safeText(actionKind),

    projectIntentPendingChoiceActive: !!pendingChoice?.isActive,
    projectIntentPendingChoiceKind: safeText(pendingChoice?.kind),
    projectIntentPendingChoiceTargetEntity: safeText(pendingChoice?.targetEntity),
    projectIntentPendingChoiceTargetPath: safeText(pendingChoice?.targetPath),
    projectIntentPendingChoiceDisplayMode: safeText(pendingChoice?.displayMode),

    projectIntentContinuationActive: continuationState?.isActive === true,
    projectIntentContinuationSourceKind: safeText(continuationState?.sourceKind),
    projectIntentContinuationTargetPath: safeText(continuationState?.targetPath),
    projectIntentContinuationDisplayMode: safeText(continuationState?.displayMode),
    projectIntentContinuationChunkIndex: Number(continuationState?.chunkIndex || 1),
    projectIntentContinuationChunkCount: Number(continuationState?.chunkCount || chunks.length || 0),
    projectIntentContinuationChunksJson: chunks.length > 0 ? JSON.stringify(chunks) : "",
    projectIntentContinuationRemainingText: safeText(continuationState?.remainingText),
  };
}

export default {
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
};
