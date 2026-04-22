// src/bot/handlers/pmConfirmedWrite.js
// ============================================================================
// Project Memory confirmed write flow
// Purpose:
// - thin Telegram adapter for confirmed project memory writes
// - no business logic here
// - parse input -> validate -> call universal confirmed writer
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function splitItems(value = "") {
  return String(value ?? "")
    .split(/\s*\|\s*/)
    .map((item) => safeText(item))
    .filter(Boolean);
}

function pickLine(map, ...keys) {
  for (const key of keys) {
    if (safeText(map[key])) return safeText(map[key]);
  }
  return "";
}

function parseBooleanLike(value, def = undefined) {
  const s = safeText(value).toLowerCase();

  if (!s) return def;
  if (["1", "true", "yes", "y", "on", "enabled"].includes(s)) return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(s)) return false;

  return def;
}

function parseConfirmedWriteInput(rest = "") {
  const text = safeText(rest);

  if (!text) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line ?? ""))
    .filter((line) => line.trim().length > 0);

  if (!lines.length) {
    return null;
  }

  const map = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.*)$/);

    if (!match) continue;

    const rawKey = safeText(match[1]).toLowerCase().replace(/\s+/g, "_");
    const rawValue = safeText(match[2]);

    map[rawKey] = rawValue;
  }

  const kind = pickLine(map, "kind", "type", "entry_type");
  const section = pickLine(map, "section");
  const title = pickLine(map, "title", "name");
  const content = pickLine(map, "content", "text", "body");
  const moduleKey = pickLine(map, "module", "module_key");
  const stageKey = pickLine(map, "stage", "stage_key");
  const sourceRef = pickLine(map, "source", "source_ref");

  const tags = splitItems(pickLine(map, "tags", "tag"));
  const relatedPaths = splitItems(pickLine(map, "paths", "related_paths", "files"));
  const aiContext = parseBooleanLike(
    pickLine(map, "context", "ai_context", "use_in_context"),
    undefined
  );

  return {
    kind,
    section,
    title,
    content,
    moduleKey,
    stageKey,
    sourceRef,
    tags,
    relatedPaths,
    aiContext,
  };
}

function buildUsage() {
  return [
    "Использование: /pm_confirmed_write",
    "",
    "Обязательные поля:",
    "kind: section_state | decision | constraint | next_step",
    "content: текст записи",
    "",
    "Необязательное поле для AI context:",
    "context: yes | no",
    "",
    "Правило:",
    "- section_state по умолчанию НЕ идёт в AI context",
    "- decision / constraint / next_step по умолчанию идут в AI context",
    "",
    "Пример 1:",
    "kind: decision",
    "title: Confirmed memory rule",
    "content: Project background context must use confirmed curated memory only.",
    "module: project_memory",
    "stage: 7A",
    "tags: confirmed | decision",
    "paths: projectMemory.js | core/projectContext.js",
    "",
    "Пример 2:",
    "kind: section_state",
    "section: project",
    "title: PROJECT",
    "content: Canonical project description for AI background context.",
    "context: yes",
    "",
    "Разделитель списков: |",
  ].join("\n");
}

export async function handlePmConfirmedWrite({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  writeConfirmedProjectMemory,
}) {
  if (typeof writeConfirmedProjectMemory !== "function") {
    await bot.sendMessage(chatId, "⛔ writeConfirmedProjectMemory недоступен.");
    return;
  }

  const parsed = parseConfirmedWriteInput(rest);

  if (!parsed || !parsed.kind || !parsed.content) {
    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  try {
    const saved = await writeConfirmedProjectMemory({
      kind: parsed.kind,
      section: parsed.section || undefined,
      title: parsed.title || null,
      content: parsed.content,
      tags: parsed.tags,
      sourceType: "manual",
      sourceRef: parsed.sourceRef || `telegram:${safeText(chatIdStr || chatId)}`,
      relatedPaths: parsed.relatedPaths,
      moduleKey: parsed.moduleKey || null,
      stageKey: parsed.stageKey || null,
      aiContext: parsed.aiContext,
      meta: {
        transport: "telegram",
        manual: true,
        bypass: !!bypass,
        chatId: safeText(chatIdStr || chatId),
      },
    });

    await bot.sendMessage(
      chatId,
      [
        "✅ Confirmed project memory записана.",
        `id: ${saved?.id ?? "-"}`,
        `section: ${saved?.section ?? "-"}`,
        `entry_type: ${saved?.entry_type ?? "-"}`,
        `ai_context: ${
          saved?.meta && typeof saved.meta === "object" && saved.meta.aiContext === true
            ? "yes"
            : "no"
        }`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /pm_confirmed_write error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка записи confirmed project memory.");
  }
}

export default {
  handlePmConfirmedWrite,
};
