// src/bot/handlers/pmConfirmedContext.js
// ============================================================================
// Project Memory confirmed context preview flow
// Purpose:
// - thin Telegram adapter for previewing final confirmed AI context
// - no business logic here
// - call transport-agnostic context builder and render text
// - read-only diagnostic path for scoped Project Memory context
// - default Telegram output is compact; full output remains available
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function compactText(value, maxLength = 220) {
  const text = safeText(value).replace(/\s+/g, " ");

  if (!text) return "-";
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}...`;
}

function parseArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  const out = {
    projectArea: null,
    repoScope: null,
    linkedArea: null,
    linkedRepo: null,
    crossRepo: undefined,
    full: false,
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === "full" || lower === "--full") {
      out.full = true;
      continue;
    }

    if (lower === "compact" || lower === "--compact") {
      out.full = false;
      continue;
    }

    if (lower.startsWith("area:")) {
      out.projectArea = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("repo:")) {
      out.repoScope = safeText(token.slice(5));
      continue;
    }

    if (lower.startsWith("linked_area:")) {
      out.linkedArea = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("linked_repo:")) {
      out.linkedRepo = safeText(token.slice(12));
      continue;
    }

    if (lower.startsWith("cross_repo:")) {
      out.crossRepo = parseBooleanLike(token.slice(11), undefined);
      continue;
    }
  }

  return out;
}

function buildFilterLabel(args = {}) {
  const parts = [];

  if (args.projectArea) parts.push(`area=${args.projectArea}`);
  if (args.repoScope) parts.push(`repo=${args.repoScope}`);
  if (args.linkedArea) parts.push(`linked_area=${args.linkedArea}`);
  if (args.linkedRepo) parts.push(`linked_repo=${args.linkedRepo}`);
  if (typeof args.crossRepo === "boolean") {
    parts.push(`cross_repo=${args.crossRepo ? "yes" : "no"}`);
  }

  return parts.length ? `[${parts.join(", ")}]` : "";
}

function buildUsage() {
  return [
    "Использование: /pm_confirmed_context",
    "",
    "Показывает preview confirmed AI-context из Project Memory.",
    "Это read-only diagnostic команда.",
    "",
    "Режимы:",
    "compact / --compact = короткий preview по умолчанию",
    "full / --full = полный AI-context как раньше",
    "",
    "Поддерживаемые фильтры:",
    "area:<value>",
    "repo:<value>",
    "linked_area:<value>",
    "linked_repo:<value>",
    "cross_repo:true|false",
    "",
    "Примеры:",
    "/pm_confirmed_context area:shared repo:shared cross_repo:true",
    "/pm_confirmed_context full area:shared repo:shared cross_repo:true",
    "/pm_confirmed_context linked_area:infra linked_repo:core cross_repo:true",
    "",
    "Важно:",
    "- команда ничего не записывает",
    "- команда ничего не обновляет",
    "- compact меняет только Telegram-отображение",
    "- полный AI-context строит core/context-builder",
  ].join("\n");
}

function splitContextSections(contextText = "") {
  const lines = String(contextText ?? "").split(/\r?\n/);

  const sections = {
    sectionState: [],
    decisions: [],
    constraints: [],
    nextSteps: [],
  };

  let current = null;

  for (const rawLine of lines) {
    const line = String(rawLine ?? "").trim();

    if (!line) continue;

    if (line === "SECTION STATE:") {
      current = "sectionState";
      continue;
    }

    if (line === "DECISIONS:") {
      current = "decisions";
      continue;
    }

    if (line === "CONSTRAINTS:") {
      current = "constraints";
      continue;
    }

    if (line === "NEXT STEPS:") {
      current = "nextSteps";
      continue;
    }

    if (!current) continue;

    if (line.startsWith("- ")) {
      sections[current].push(line.slice(2));
      continue;
    }

    if (sections[current].length) {
      const lastIndex = sections[current].length - 1;
      sections[current][lastIndex] = `${sections[current][lastIndex]} ${line}`;
    }
  }

  return sections;
}

function formatPreviewItem(item = "") {
  const text = safeText(item);

  if (!text) return "-";

  const scopeStart = text.indexOf(" [");
  const title = scopeStart >= 0 ? text.slice(0, scopeStart) : text;

  return compactText(title, 180);
}

function buildCompactContextPreview(contextText = "", args = {}) {
  const filterLabel = buildFilterLabel(args);
  const sections = splitContextSections(contextText);

  const lines = [
    `🧠 Confirmed context preview ${filterLabel || ""}`.trim(),
    "mode=compact transport=telegram",
    "note=preview only; full AI-context unchanged",
    "",
  ];

  const decisionItems = sections.decisions.slice(0, 8);
  const constraintItems = sections.constraints.slice(0, 8);
  const nextStepItems = sections.nextSteps.slice(0, 8);
  const sectionStateItems = sections.sectionState.slice(0, 5);

  const total =
    decisionItems.length +
    constraintItems.length +
    nextStepItems.length +
    sectionStateItems.length;

  lines.push(
    `items: decisions=${sections.decisions.length} constraints=${sections.constraints.length} next_steps=${sections.nextSteps.length} section_state=${sections.sectionState.length}`
  );

  if (!total) {
    lines.push("");
    lines.push(compactText(contextText, 900));
    lines.push("");
    lines.push("Для полного вывода: /pm_confirmed_context full ...");
    return lines.join("\n");
  }

  if (decisionItems.length) {
    lines.push("");
    lines.push("DECISIONS:");
    for (const item of decisionItems) {
      lines.push(`- ${formatPreviewItem(item)}`);
    }
  }

  if (constraintItems.length) {
    lines.push("");
    lines.push("CONSTRAINTS:");
    for (const item of constraintItems) {
      lines.push(`- ${formatPreviewItem(item)}`);
    }
  }

  if (nextStepItems.length) {
    lines.push("");
    lines.push("NEXT:");
    for (const item of nextStepItems) {
      lines.push(`- ${formatPreviewItem(item)}`);
    }
  }

  if (sectionStateItems.length) {
    lines.push("");
    lines.push("SECTION STATE:");
    for (const item of sectionStateItems) {
      lines.push(`- ${formatPreviewItem(item)}`);
    }
  }

  lines.push("");
  lines.push("Для полного вывода: /pm_confirmed_context full ...");

  return lines.join("\n");
}

async function sendChunked(bot, chatId, title, content) {
  const SAFE_LIMIT = 3800;
  const header = safeText(title);
  const text = String(content ?? "");

  if (!text) {
    await bot.sendMessage(chatId, header || "Пусто.");
    return;
  }

  const full = header ? `${header}\n\n${text}` : text;

  if (full.length <= SAFE_LIMIT) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const parts = [];
  let cursor = 0;

  while (cursor < text.length) {
    parts.push(text.slice(cursor, cursor + 3000));
    cursor += 3000;
  }

  for (let i = 0; i < parts.length; i++) {
    const prefix = header
      ? `${header}\nчасть ${i + 1}/${parts.length}\n\n`
      : `часть ${i + 1}/${parts.length}\n\n`;

    const available = Math.max(500, SAFE_LIMIT - prefix.length);
    const body = parts[i].slice(0, available);

    await bot.sendMessage(chatId, prefix + body);
  }
}

export async function handlePmConfirmedContext({
  bot,
  chatId,
  rest,
  buildConfirmedProjectMemoryContext,
}) {
  if (typeof buildConfirmedProjectMemoryContext !== "function") {
    await bot.sendMessage(chatId, "⛔ buildConfirmedProjectMemoryContext недоступен.");
    return;
  }

  const text = safeText(rest);

  if (text === "help" || text === "--help" || text === "-h") {
    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  try {
    const args = parseArgs(rest);

    const contextText = await buildConfirmedProjectMemoryContext({
      projectArea: args.projectArea,
      repoScope: args.repoScope,
      linkedArea: args.linkedArea,
      linkedRepo: args.linkedRepo,
      crossRepo: args.crossRepo,
    });

    const filterLabel = buildFilterLabel(args);

    if (!safeText(contextText)) {
      await bot.sendMessage(
        chatId,
        `🧠 Confirmed context preview ${filterLabel || ""}: пусто.`.trim()
      );
      return;
    }

    if (args.full === true) {
      const title = `🧠 Confirmed context preview ${filterLabel || ""} full`.trim();
      await sendChunked(bot, chatId, title, contextText);
      return;
    }

    const compactPreview = buildCompactContextPreview(contextText, args);
    await sendChunked(bot, chatId, "", compactPreview);
  } catch (e) {
    console.error("❌ /pm_confirmed_context error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка построения confirmed context preview.");
  }
}

export default {
  handlePmConfirmedContext,
};
