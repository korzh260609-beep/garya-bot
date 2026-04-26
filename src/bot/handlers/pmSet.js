// src/bot/handlers/pmSet.js
// extracted from case "/pm_set" — no logic changes

function safeText(value) {
  return String(value ?? "").trim();
}

function tracePmSetAttempt({
  chatId,
  chatIdStr,
  bypass,
  phase,
  reason,
  section,
  hasContent,
} = {}) {
  console.log("🧠 PROJECT_MEMORY_PM_SET_ATTEMPT", {
    transport: "telegram",
    chatId: safeText(chatIdStr || chatId),
    bypass: !!bypass,
    phase: safeText(phase) || "unknown",
    reason: safeText(reason) || null,
    section: safeText(section) || null,
    hasContent: !!hasContent,
  });
}

export async function handlePmSet({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  upsertProjectSection,
}) {
  tracePmSetAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "received",
  });

  if (!bypass) {
    tracePmSetAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "not_trusted_path",
    });

    await bot.sendMessage(chatId, "Только монарх может менять Project Memory.");
    return;
  }

  const parts = (rest || "").trim().split(/\s+/);
  const section = parts.shift();
  const content = parts.join(" ").trim();

  if (!section || !content) {
    tracePmSetAttempt({
      chatId,
      chatIdStr,
      bypass,
      phase: "rejected",
      reason: "invalid_input",
      section,
      hasContent: !!content,
    });

    await bot.sendMessage(
      chatId,
      "Использование: /pm_set <section> <text>\n(Можно с переносами строк)"
    );
    return;
  }

  tracePmSetAttempt({
    chatId,
    chatIdStr,
    bypass,
    phase: "accepted",
    section,
    hasContent: true,
  });

  try {
    await upsertProjectSection({
      section,
      title: null,
      content,
      tags: [],
      meta: { setBy: chatIdStr },
      schemaVersion: 1,
    });

    await bot.sendMessage(chatId, `✅ Обновлено: ${section}`);
  } catch (e) {
    console.error("❌ /pm_set error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка записи Project Memory.");
  }
}

