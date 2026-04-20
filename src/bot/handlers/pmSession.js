// src/bot/handlers/pmSession.js
// ============================================================================
// Controlled manual work-session recorder for Project Memory V2
// Purpose:
// - first safe/manual entry point for session summaries
// - no automatic chat-wide capture
// - transport remains thin; storage logic stays in projectMemory layer
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeListItem(value) {
  return safeText(String(value ?? "").replace(/^[-*•]\s*/, ""));
}

function parseSessionInput(rest = "") {
  const text = String(rest ?? "").replace(/^\s+/, "");
  const lines = text.split(/\r?\n/);

  const scalarSections = new Set(["title", "goal"]);
  const listSections = new Set([
    "checked",
    "changed",
    "decisions",
    "risks",
    "next",
    "notes",
    "tags",
    "related_paths",
  ]);

  const data = {
    title: "",
    goal: "",
    checked: [],
    changed: [],
    decisions: [],
    risks: [],
    next: [],
    notes: [],
    tags: [],
    related_paths: [],
    module_key: "",
    stage_key: "",
    source_ref: "",
  };

  let currentKey = null;

  function pushScalar(key, value) {
    const s = safeText(value);
    if (!s) return;
    data[key] = data[key] ? `${data[key]}\n${s}` : s;
  }

  function pushList(key, value) {
    const s = normalizeListItem(value);
    if (!s) return;
    data[key].push(s);
  }

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const match = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);

    if (match) {
      const key = safeText(match[1]).toLowerCase();
      const inlineValue = match[2] ?? "";

      if (scalarSections.has(key)) {
        currentKey = key;
        pushScalar(key, inlineValue);
        continue;
      }

      if (listSections.has(key)) {
        currentKey = key;
        pushList(key, inlineValue);
        continue;
      }

      if (key === "module_key" || key === "stage_key" || key === "source_ref") {
        currentKey = key;
        data[key] = safeText(inlineValue);
        continue;
      }
    }

    if (!currentKey) continue;

    if (scalarSections.has(currentKey)) {
      pushScalar(currentKey, line);
      continue;
    }

    if (listSections.has(currentKey)) {
      pushList(currentKey, line);
      continue;
    }

    if (
      currentKey === "module_key" ||
      currentKey === "stage_key" ||
      currentKey === "source_ref"
    ) {
      const s = safeText(line);
      if (!s) continue;
      data[currentKey] = data[currentKey]
        ? `${data[currentKey]} ${s}`.trim()
        : s;
    }
  }

  return {
    title: safeText(data.title) || null,
    goal: safeText(data.goal),
    checked: data.checked,
    changed: data.changed,
    decisions: data.decisions,
    risks: data.risks,
    nextSteps: data.next,
    notes: data.notes,
    tags: data.tags,
    relatedPaths: data.related_paths,
    moduleKey: safeText(data.module_key) || null,
    stageKey: safeText(data.stage_key) || null,
    sourceRef: safeText(data.source_ref) || null,
  };
}

function hasMeaningfulSessionContent(input = {}) {
  return Boolean(
    safeText(input.goal) ||
      input.checked?.length ||
      input.changed?.length ||
      input.decisions?.length ||
      input.risks?.length ||
      input.nextSteps?.length ||
      input.notes?.length
  );
}

function buildUsageText() {
  return [
    "Использование: /pm_session + блоки с новой строки",
    "",
    "Пример:",
    "/pm_session",
    "title: Project Memory V2 session",
    "goal: add first controlled work-session save flow",
    "checked:",
    "- projectMemory.js",
    "- ProjectMemorySessionRecorder.js",
    "changed:",
    "- added /pm_session handler",
    "decisions:",
    "- use manual command first",
    "risks:",
    "- no auto chat capture yet",
    "next:",
    "- add safe read/list flow for sessions",
    "notes:",
    "- keep architecture transport-agnostic",
    "module_key: project_memory",
    "stage_key: 7A",
    "source_ref: telegram_manual_command",
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
  if (!bypass) {
    await bot.sendMessage(
      chatId,
      "Только монарх может записывать work-session в Project Memory."
    );
    return;
  }

  const parsed = parseSessionInput(rest);

  if (!hasMeaningfulSessionContent(parsed)) {
    await bot.sendMessage(chatId, buildUsageText());
    return;
  }

  try {
    const row = await recordProjectWorkSession({
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
      sourceRef: parsed.sourceRef || `telegram:${chatIdStr}`,
      relatedPaths: parsed.relatedPaths,
      moduleKey: parsed.moduleKey,
      stageKey: parsed.stageKey,
      meta: {
        transport: "telegram",
        chatId: chatIdStr,
        recordedBy: chatIdStr,
        mode: "manual_command",
        command: "/pm_session",
      },
    });

    await bot.sendMessage(
      chatId,
      [
        "✅ Work-session сохранён в Project Memory.",
        `id: ${row?.id ?? "unknown"}`,
        `section: ${row?.section ?? "work_sessions"}`,
        `entry_type: ${row?.entry_type ?? "session_summary"}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /pm_session error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка записи work-session в Project Memory.");
  }
}

export default {
  handlePmSession,
};