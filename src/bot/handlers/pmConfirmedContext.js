// src/bot/handlers/pmConfirmedContext.js
// ============================================================================
// Project Memory confirmed context preview flow
// Purpose:
// - thin Telegram adapter for previewing final confirmed AI context
// - no business logic here
// - call transport-agnostic context builder and render full text
// - read-only diagnostic path for scoped Project Memory context
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

function parseArgs(rest = "") {
  const tokens = safeText(rest).split(/\s+/).filter(Boolean);

  const out = {
    projectArea: null,
    repoScope: null,
    linkedArea: null,
    linkedRepo: null,
    crossRepo: undefined,
  };

  for (const token of tokens) {
    const lower = token.toLowerCase();

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
    "Показывает финальный confirmed AI-context, который собирается из Project Memory.",
    "Это read-only diagnostic preview.",
    "",
    "Поддерживаемые фильтры:",
    "area:<value>",
    "repo:<value>",
    "linked_area:<value>",
    "linked_repo:<value>",
    "cross_repo:true|false",
    "",
    "Примеры:",
    "/pm_confirmed_context",
    "/pm_confirmed_context area:core repo:core",
    "/pm_confirmed_context area:client repo:client cross_repo:false",
    "/pm_confirmed_context linked_area:infra linked_repo:core cross_repo:true",
    "",
    "Важно:",
    "- команда ничего не записывает",
    "- команда ничего не обновляет",
    "- это preview финального AI-context блока",
  ].join("\n");
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

    const title = `🧠 Confirmed context preview ${filterLabel || ""}`.trim();
    await sendChunked(bot, chatId, title, contextText);
  } catch (e) {
    console.error("❌ /pm_confirmed_context error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка построения confirmed context preview.");
  }
}

export default {
  handlePmConfirmedContext,
};