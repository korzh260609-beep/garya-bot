// src/core/projectIntent/conversation/projectIntentConversationHumanReplies.js

import { safeText } from "../projectIntentConversationShared.js";

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

export default {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
};