// src/bot/handlers/pmSet.js
// extracted from case "/pm_set" — no logic changes

export async function handlePmSet({
  bot,
  chatId,
  chatIdStr,
  rest,
  bypass,
  upsertProjectSection,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Только монарх может менять Project Memory.");
    return;
  }

  const parts = (rest || "").trim().split(/\s+/);
  const section = parts.shift();
  const content = parts.join(" ").trim();

  if (!section || !content) {
    await bot.sendMessage(
      chatId,
      "Использование: /pm_set <section> <text>\n(Можно с переносами строк)"
    );
    return;
  }

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

