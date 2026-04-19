// src/core/projectIntent/projectIntentConversationReplies.js

import { safeText } from "./projectIntentConversationShared.js";

export function humanRepoStatusReply({ snapshot, filesCount }) {
  return [
    "Я вижу репозиторий проекта и могу читать его в режиме только чтения.",
    `Сейчас у меня есть доступ к актуальному снимку репозитория ${safeText(snapshot?.repo)} на ветке ${safeText(snapshot?.branch)}.`,
    `В индексе сейчас примерно ${filesCount} файлов.`,
    "Можешь попросить меня показать корень репозитория, найти файл, открыть документ, кратко пересказать его или объяснить смысл.",
  ].join("\n");
}

export function humanSearchReply({ targetEntity, matches }) {
  const target = safeText(targetEntity) || "нужный объект";

  if (!Array.isArray(matches) || matches.length === 0) {
    return `Я поискал в репозитории ${target}, но ничего подходящего не нашёл. Попробуй уточнить имя файла, путь или смысловой ориентир.`;
  }

  if (matches.length === 1) {
    return [
      "Я нашёл точное совпадение.",
      `Это файл \`${matches[0]}\`.`,
      "Могу сразу открыть его, кратко пересказать или объяснить смысл простыми словами.",
    ].join("\n");
  }

  const lines = matches.slice(0, 6).map((path) => `- \`${path}\``);
  return [
    `Я нашёл несколько вариантов для запроса "${target}":`,
    ...lines,
    "",
    "Скажи, какой открыть, или напиши: «открой первый», «объясни первый», «кратко первый».",
  ].join("\n");
}

export function humanTreeReply({ prefix, directories, files, hiddenCount }) {
  const isRoot = !safeText(prefix);
  const title = isRoot
    ? "Я показал корень репозитория."
    : `Я показал верхний уровень папки \`${safeText(prefix)}\`.`;

  const lines = [title];

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
    lines.push(`Я показал только верхний уровень, а ещё ${hiddenCount} элементов глубже не раскрывал, чтобы не перегружать ответ.`);
  } else {
    lines.push("Я специально показал только верхний уровень, чтобы было удобно углубляться дальше по папкам.");
  }

  lines.push("Можешь написать, какую папку раскрыть дальше, например: `покажи src/` или `раскрой pillars/`.");

  return lines.join("\n");
}

export function humanFolderBrowseReply({ folderPath, directories, files, hiddenCount }) {
  const folder = safeText(folderPath) || "/";
  const lines = [`Я показал содержимое папки \`${folder}\`.`];

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

  if (directories.length === 0 && files.length === 0) {
    lines.push("");
    lines.push("Похоже, в текущем снимке у этой папки нет элементов на верхнем уровне.");
  }

  lines.push("");
  if (hiddenCount > 0) {
    lines.push(`Я показал только прямое содержимое папки. Глубже внутри есть ещё ${hiddenCount} элементов.`);
  } else {
    lines.push("Я показал только прямое содержимое папки без углубления дальше.");
  }

  lines.push("Можешь написать, что делать дальше: `открой файл`, `раскрой подпапку` или `покажи корень репозитория`.");

  return lines.join("\n");
}

export function humanLargeDocumentReply({ path }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "этот документ";
  return [
    `Я нашёл документ ${name}.`,
    "Он большой, поэтому не буду молча вставлять длинную простыню целиком.",
    "Как поступить дальше?",
    "- кратко пересказать",
    "- объяснить простыми словами",
    "- показать первую часть",
    "- перевести на русский",
    "- разобрать конкретный раздел",
  ].join("\n");
}

export function humanSmallDocumentReply({ path, content, wasTrimmed }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "документ";
  const lines = [`Я открыл ${name}.`];

  if (wasTrimmed) {
    lines.push("Документ длинный, поэтому здесь только первая часть.");
    lines.push("Могу продолжить дальше, кратко пересказать или объяснить смысл.");
  }

  lines.push("");
  lines.push("```");
  lines.push(content);
  lines.push("```");

  return lines.join("\n");
}

export function humanFirstPartDocumentReply({ path, content, maxChars = 2600 }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "документ";
  const preview = safeText(content).slice(0, maxChars);

  return [
    `Я показываю первую часть файла ${name}.`,
    "",
    "```",
    preview,
    "```",
    "",
    "Могу показать следующую часть, кратко пересказать или объяснить смысл.",
  ].join("\n");
}

export function humanClarificationReply(question) {
  return safeText(question) || "Уточни, что именно нужно сделать с репозиторием.";
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
        "Говори нормальным человеческим языком.\n" +
        "Не упоминай route, handler, bridge, snapshotId, команды и другую техничку.\n" +
        "Опирайся только на текст файла.\n" +
        "Если данных не хватает — честно скажи.\n" +
        "Не придумывай того, чего нет в документе.\n" +
        "Нельзя просить пользователя прислать полный текст файла или его части, потому что текст файла уже передан тебе системой.\n" +
        "Нельзя писать общие догадки о файле только по его названию.\n" +
        "Если файл найден в репозитории, нужно отвечать только по его реальному содержимому.\n" +
        "Если файл описывает проект, объясняй именно проект, а не абстрактные догадки.",
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
}) {
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
