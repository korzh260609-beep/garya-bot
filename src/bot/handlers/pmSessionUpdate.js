// src/bot/handlers/pmSessionUpdate.js
// ============================================================================
// Project Memory work-session update flow
// Purpose:
// - thin Telegram adapter for updating existing work-session summaries
// - no update logic inside handler
// - parse input -> validate -> call transport-agnostic use-case
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

function traceSessionUpdateAttempt({
  chatId,
  chatIdStr,
  bypass,
  phase,
  reason,
  id,
  patchKeys,
} = {}) {
  console.log("🧠 PROJECT_MEMORY_SESSION_UPDATE_ATTEMPT", {
    transport: "telegram",
    chatId: safeText(chatIdStr || chatId),
    bypass: !!bypass,
    phase: safeText(phase) || "unknown",
    reason: safeText(reason) || null,
    id: Number.isInteger(id) ? id : null,
    patchKeys: Array.isArray(patchKeys) ? patchKeys : [],
  });
}

function parseSessionUpdateInput(rest = "") {
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

  const firstLine = safeText(lines[0]);
  const idMatch = firstLine.match(/^(\d+)\s*$/);

  if (!idMatch) {
    return null;
  }

  const id = Number.parseInt(idMatch[1], 10);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const map = {};

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.*)$/);

    if (!match) {
      continue;
    }

    const rawKey = safeText(match[1]).toLowerCase().replace(/\s+/g, "_");
    const rawValue = safeText(match[2]);

    map[rawKey] = rawValue;
  }

  const patch = {};

  const title = pickLine(map, "title", "session", "name");
  if (title) patch.title = title;

  const goal = pickLine(map, "goal");
  if (goal) patch.goal = goal;

  const checked = splitItems(pickLine(map, "checked", "checked_items"));
  if (checked.length) patch.checked = checked;

  const changed = splitItems(pickLine(map, "changed", "changes"));
  if (changed.length) patch.changed = changed;

  const decisions = splitItems(pickLine(map, "decisions", "decision"));
  if (decisions.length) patch.decisions = decisions;

  const risks = splitItems(pickLine(map, "risks", "risk"));
  if (risks.length) patch.risks = risks;

  const nextSteps = splitItems(pickLine(map, "next", "next_steps", "todo"));
  if (nextSteps.length) patch.nextSteps = nextSteps;

  const notes = splitItems(pickLine(map, "notes", "note"));
  if (notes.length) patch.notes = notes;

  const tags = splitItems(pickLine(map, "tags", "tag"));
  if (tags.length) patch.tags = tags;

  const relatedPaths = splitItems(
    pickLine(map, "paths", "related_paths", "files")
  );
  if (relatedPaths.length) patch.relatedPaths = relatedPaths;

  const moduleKey = pickLine(map, "module", "module_key");
  if (moduleKey) patch.moduleKey = moduleKey;

  const stageKey = pickLine(map, "stage", "stage_key");
  if (stageKey) patch.stageKey = stageKey;

  const sourceRef = pickLine(map, "source", "source_ref");
  if (sourceRef) patch.sourceRef = sourceRef;

  return {
    id,
    patch,
  };
}

function buildUsage() {
  return [
    "Использование: /pm_session_update",
    "",
    "Первая строка: id сессии",
    "Дальше только поля, которые нужно обновить.",
    "",
    "Пример:",
    "15",
    "title: Stage 7A deploy fix updated",
    "goal: добили service-layer update",
    "changed: добавлен updater use-case | подключён wiring",
    "decisions: update идёт через facade, не через handler",
    "risks: нужен тонкий transport adapter без логики",
    "next: сделать /pm_session_update | протестировать в Telegram",
    "notes: обновление существующей session_summary",
    "module: project_memory",
    "stage: 7A",
    "source: telegram_manual_update",
    "tags: pm | session_update",
    "paths: src/projectMemory/ProjectMemoryService.js | projectMemory.js",
    "",
    "Разделитель в списках: |",
    "",
    "Важно:",
    "- id обязателен",
    "- укажи хотя бы одно поле для обновления",
    "- не передавай сырой content, если можно передать нормальные поля",
  ].join("\n");
}

export async function handlePmSessionUpdate({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  updateProjectWorkSession,
}) {
  traceSessionUpdateAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "received",
  });

  if (typeof updateProjectWorkSession !== "function") {
    traceSessionUpdateAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "updater_unavailable",
    });

    await bot.sendMessage(chatId, "⛔ updateProjectWorkSession недоступен.");
    return;
  }

  if (!bypass) {
    traceSessionUpdateAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "not_trusted_path",
    });

    await bot.sendMessage(
      chatId,
      "⛔ Durable Project Memory session update доступен только монарху / trusted path."
    );
    return;
  }

  const parsed = parseSessionUpdateInput(rest);

  if (!parsed) {
    traceSessionUpdateAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "invalid_input",
    });

    await bot.sendMessage(chatId, buildUsage());
    return;
  }

  const patchKeys = Object.keys(parsed.patch || {});

  if (!patchKeys.length) {
    traceSessionUpdateAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "empty_patch",
      id: parsed.id,
      patchKeys,
    });

    await bot.sendMessage(chatId, "⚠️ Не указано ни одного поля для обновления.\n\n" + buildUsage());
    return;
  }

  traceSessionUpdateAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "accepted",
    id: parsed.id,
    patchKeys,
  });

  try {
    const updated = await updateProjectWorkSession({
      id: parsed.id,
      patch: parsed.patch,
    });

    await bot.sendMessage(
      chatId,
      [
        "✅ Work-session обновлён в Project Memory.",
        `id: ${updated?.id ?? parsed.id}`,
        `section: ${updated?.section ?? "work_sessions"}`,
        `entry_type: ${updated?.entry_type ?? "session_summary"}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /pm_session_update error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка обновления work-session в Project Memory.");
  }
}

export default {
  handlePmSessionUpdate,
};