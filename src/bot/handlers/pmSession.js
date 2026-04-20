// src/bot/handlers/pmSession.js
// ============================================================================
// Project Memory work-session write flow
// Purpose:
// - manual controlled save of work-session summaries
// - no auto-capture
// - no auto-analysis
// - uses Project Memory V2 recorder facade only
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

function parseSessionInput(rest = "") {
  const text = safeText(rest);

  if (!text) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => String(line ?? ""))
    .filter((line) => line.trim().length > 0);

  const map = {};
  const freeform = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.*)$/);

    if (!match) {
      freeform.push(line);
      continue;
    }

    const rawKey = safeText(match[1]).toLowerCase().replace(/\s+/g, "_");
    const rawValue = safeText(match[2]);

    map[rawKey] = rawValue;
  }

  const title =
    pickLine(map, "title", "session", "name") || "Work session";

  const goal =
    pickLine(map, "goal", "summary", "task", "what") ||
    freeform.join(" ");

  const checked = splitItems(pickLine(map, "checked", "checked_items"));
  const changed = splitItems(pickLine(map, "changed", "changes"));
  const decisions = splitItems(pickLine(map, "decisions", "decision"));
  const risks = splitItems(pickLine(map, "risks", "risk"));
  const nextSteps = splitItems(pickLine(map, "next", "next_steps", "todo"));
  const notes = splitItems(pickLine(map, "notes", "note"));
  const tags = splitItems(pickLine(map, "tags", "tag"));
  const relatedPaths = splitItems(
    pickLine(map, "paths", "related_paths", "files")
  );

  const moduleKey = pickLine(map, "module", "module_key");
  const stageKey = pickLine(map, "stage", "stage_key");
  const sourceRef = pickLine(map, "source", "source_ref");

  return {
    title,
    goal,
    checked,
    changed,
    decisions,
    risks,
    nextSteps,
    notes,
    tags,
    relatedPaths,
    moduleKey,
    stageKey,
    sourceRef,
  };
}

function buildUsage() {
  return [
    "Использование: /pm_session",
    "",
    "Минимум:",
    "goal: что было сделано",
    "",
    "Рекомендуемый формат:",
    "title: Stage 7A deploy fix",
    "goal: восстановили write/read flow Project Memory",
    "checked: dispatchProjectMemoryCommands.js | contextBuilders.js",
    "changed: восстановлен pmSession.js | создан pmSessions.js",
    "decisions: сначала чиним deploy, потом slicing",
    "risks: возможен импортный конфликт если файл не закоммитить",
    "next: redeploy | test /pm_session | test /pm_sessions",
    "notes: ручная запись без auto-capture",
    "module: project_memory",
    "stage: 7A",
    "source: telegram_manual",
    "tags: pm | work_session",
    "paths: src/bot/handlers/pmSession.js | src/bot/handlers/pmSessions.js",
    "",
    "Разделитель в списках: |",
  ].join("\n");
}

export async function handlePmSession({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  recordProjectWorkSession,
}) {
  if (typeof recordProjectWorkSession !== "function") {
    await bot.sendMessage(chatId, "⛔ recordProjectWorkSession недоступен.");
    return;
  }

  const parsed = parseSessionInput(rest);

  if (!parsed || !safeText(parsed.goal)) {
    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  try {
    const saved = await recordProjectWorkSession({
      title: parsed.title,
      goal: parsed.goal,
      checked: parsed.checked,
      changed: parsed.changed,
      decisions: parsed.decisions,
      risks: parsed.risks,
      nextSteps: parsed.nextSteps,
      notes: parsed.notes,
      tags: parsed.tags,
      sourceType: "chat_session",
      sourceRef: parsed.sourceRef || `telegram:${safeText(chatIdStr || chatId)}`,
      relatedPaths: parsed.relatedPaths,
      moduleKey: parsed.moduleKey || "project_memory",
      stageKey: parsed.stageKey || "7A",
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
        "✅ Work-session сохранён в Project Memory.",
        `id: ${saved?.id ?? "-"}`,
        `section: ${saved?.section ?? "work_sessions"}`,
        `entry_type: ${saved?.entry_type ?? "session_summary"}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /pm_session error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка сохранения work-session в Project Memory.");
  }
}

export default {
  handlePmSession,
};