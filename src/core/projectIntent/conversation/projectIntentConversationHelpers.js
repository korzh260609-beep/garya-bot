// src/core/projectIntent/conversation/projectIntentConversationHelpers.js

import {
  safeText,
  normalizePath,
} from "../projectIntentConversationShared.js";

export function normalizeFolderPrefix(value = "") {
  const v = normalizePath(value);
  if (!v) return "";
  if (v.endsWith("/")) return v;
  if (/\.[a-z0-9]{1,8}$/i.test(v)) return v;
  return `${v}/`;
}

export function joinFolderWithBasename(folderPath = "", basename = "") {
  const folder = normalizeFolderPrefix(folderPath);
  const file = safeText(basename).replace(/^\/+/, "");
  if (!folder || !file) return "";
  return `${folder}${file}`;
}

export function inferObjectKindFromPath(path = "") {
  const value = safeText(path);
  if (!value) return "unknown";
  if (/\.[a-z0-9]{1,8}$/i.test(value)) return "file";
  if (value.endsWith("/") || value.includes("/")) return "folder";
  return "unknown";
}

export function basenameNoExt(value = "") {
  const v = safeText(value).split("/").pop() || "";
  return v.replace(/\.[^.]+$/i, "");
}

export function classifyChildName(name = "") {
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

export function buildFolderMeaningFromChildren({ folderPath, directories, files, hiddenCount }) {
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

export function looksLikeFileInnerQuestion(text = "") {
  const t = safeText(text).toLowerCase();
  if (!t) return false;

  const mentionsInnerSubject =
    t.includes("команд") ||
    t.includes("функц") ||
    t.includes("метод") ||
    t.includes("участ") ||
    t.includes("часть") ||
    t.includes("главн") ||
    t.includes("важн") ||
    t.includes("рандом") ||
    t.includes("случайн") ||
    t.includes("section") ||
    t.includes("function") ||
    t.includes("method") ||
    t.includes("command") ||
    t.includes("part") ||
    t.includes("important") ||
    t.includes("main") ||
    t.includes("random");

  const mentionsCurrentFile =
    t.includes("из этого файла") ||
    t.includes("в этом файле") ||
    t.includes("из файла") ||
    t.includes("внутри файла") ||
    t.includes("здесь") ||
    t.includes("тут") ||
    t.includes("в этом") ||
    t.includes("inside this") ||
    t.includes("in this") ||
    t.includes("here");

  const asksForInnerExplanation =
    t.includes("расскажи") ||
    t.includes("объясни") ||
    t.includes("что делает") ||
    t.includes("что здесь") ||
    t.includes("дай информацию") ||
    t.includes("какая") ||
    t.includes("какой");

  const shortFollowup = t.split(/\s+/).filter(Boolean).length <= 10;

  return (
    (mentionsInnerSubject && (mentionsCurrentFile || asksForInnerExplanation || shortFollowup)) ||
    (mentionsCurrentFile && shortFollowup)
  );
}

export function shouldForceActiveFileExplain({ trimmed, followupContext, semanticPlan }) {
  if (followupContext?.isActive !== true) return false;
  if (safeText(followupContext?.objectKind) !== "file") return false;
  if (!looksLikeFileInnerQuestion(trimmed)) return false;

  const intent = safeText(semanticPlan?.intent);
  return (
    !intent ||
    intent === "unknown" ||
    intent === "explain_active" ||
    intent === "explain_target"
  );
}