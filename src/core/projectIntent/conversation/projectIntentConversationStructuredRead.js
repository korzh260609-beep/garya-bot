// src/core/projectIntent/conversation/projectIntentConversationStructuredRead.js

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizeCommandToken(value = "") {
  const raw = safeText(value);
  if (!raw.startsWith("/")) return "";
  return raw.replace(/@[\w.-]+$/i, "");
}

function looksLikeCommandContainer({ targetPath, content }) {
  const path = normalizeText(targetPath);
  const text = safeText(content);

  if (
    path.includes("command") ||
    path.includes("dispatcher") ||
    path.includes("router") ||
    path.includes("dispatch")
  ) {
    return true;
  }

  if (text.includes('case "/') || text.includes("case '/") || text.includes("case `/")) {
    return true;
  }

  if (text.includes("PRIVATE_ONLY_COMMANDS") || text.includes("new Set([")) {
    return true;
  }

  return false;
}

function extractSlashCommandsFromCode(content = "") {
  const text = safeText(content);
  if (!text) return [];

  const found = [];

  const switchCaseRegex = /case\s+["'`](\/[A-Za-z0-9_:@./-]+)["'`]\s*:/g;
  const setEntryRegex = /["'`](\/[A-Za-z0-9_:@./-]+)["'`](?=\s*(?:,|\)|\]|\n))/g;

  let match;

  while ((match = switchCaseRegex.exec(text)) !== null) {
    found.push(normalizeCommandToken(match[1]));
  }

  while ((match = setEntryRegex.exec(text)) !== null) {
    found.push(normalizeCommandToken(match[1]));
  }

  return unique(found).sort();
}

function asksForCommandList(text = "") {
  const t = normalizeText(text);
  if (!t) return false;

  const mentionsCommands =
    t.includes("команд") ||
    t.includes("command");

  const asksList =
    t.includes("список") ||
    t.includes("перечень") ||
    t.includes("покажи") ||
    t.includes("показать") ||
    t.includes("какие") ||
    t.includes("выбери") ||
    t.includes("show") ||
    t.includes("list") ||
    t.includes("which");

  return mentionsCommands && asksList;
}

function asksForCommandImportance(text = "") {
  const t = normalizeText(text);
  if (!t) return false;

  const mentionsCommands =
    t.includes("команд") ||
    t.includes("command");

  const asksImportance =
    t.includes("самая важная") ||
    t.includes("самый важный") ||
    t.includes("главная") ||
    t.includes("ключевая") ||
    t.includes("важн") ||
    t.includes("main") ||
    t.includes("important") ||
    t.includes("key");

  return mentionsCommands && asksImportance;
}

function buildCommandListText({
  targetPath,
  commands,
  replyLimit = 3200,
}) {
  const intro = [
    `\`${safeText(targetPath)}\` — файл, где найдены явные slash-команды.`,
    "Список извлечён напрямую из текста файла, без догадок:",
    "",
  ].join("\n");

  const lines = [];
  let used = intro.length;

  for (const command of commands) {
    const line = `- ${command}`;
    if (used + line.length + 1 > Math.max(1200, replyLimit - 220)) {
      break;
    }
    lines.push(line);
    used += line.length + 1;
  }

  const hiddenCount = Math.max(0, commands.length - lines.length);

  const tail = [];
  if (hiddenCount > 0) {
    tail.push("");
    tail.push(`Показана только первая часть списка. Ещё скрыто: ${hiddenCount}.`);
  }

  return [intro, ...lines, ...tail].join("\n");
}

function buildCommandImportanceText({
  targetPath,
  commands,
}) {
  const preview = commands.slice(0, 12).map((cmd) => `- ${cmd}`);

  return [
    `\`${safeText(targetPath)}\` — файл диспетчеризации или маршрутизации команд.`,
    "По самому коду здесь не задано объективное поле «самая важная команда».",
    "Такой файл обычно распределяет входящие команды по обработчикам, а не ранжирует их по важности.",
    "",
    "Явно найденные slash-команды:",
    ...preview,
    commands.length > 12 ? `- ... и ещё ${commands.length - 12}` : "",
    "",
    "Точный ответ про «самую важную» возможен только если это явно задано в коде, документации или бизнес-логике.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function resolveStructuredRepoFileAnswer({
  text,
  targetPath,
  content,
  replyLimit = 3200,
}) {
  const rawText = safeText(text);
  const rawPath = safeText(targetPath);
  const rawContent = safeText(content);

  if (!rawText || !rawPath || !rawContent) {
    return {
      ok: false,
      kind: "",
      text: "",
      extracted: {},
    };
  }

  if (!looksLikeCommandContainer({ targetPath: rawPath, content: rawContent })) {
    return {
      ok: false,
      kind: "",
      text: "",
      extracted: {},
    };
  }

  const commands = extractSlashCommandsFromCode(rawContent);

  if (asksForCommandList(rawText)) {
    if (commands.length === 0) {
      return {
        ok: true,
        kind: "command_list_empty",
        text:
          `\`${rawPath}\` был прочитан напрямую, ` +
          "но явный список slash-команд из текста файла надёжно извлечь не удалось.",
        extracted: {
          commands: [],
        },
      };
    }

    return {
      ok: true,
      kind: "command_list",
      text: buildCommandListText({
        targetPath: rawPath,
        commands,
        replyLimit,
      }),
      extracted: {
        commands,
      },
    };
  }

  if (asksForCommandImportance(rawText)) {
    if (commands.length === 0) {
      return {
        ok: true,
        kind: "command_importance_no_commands",
        text:
          `\`${rawPath}\` был прочитан напрямую, ` +
          "но явный список slash-команд из текста файла не найден, поэтому вывод о важности делать нельзя.",
        extracted: {
          commands: [],
        },
      };
    }

    return {
      ok: true,
      kind: "command_importance",
      text: buildCommandImportanceText({
        targetPath: rawPath,
        commands,
      }),
      extracted: {
        commands,
      },
    };
  }

  return {
    ok: false,
    kind: "",
    text: "",
    extracted: {},
  };
}

export default {
  resolveStructuredRepoFileAnswer,
};