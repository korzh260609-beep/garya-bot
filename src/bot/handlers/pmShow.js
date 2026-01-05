// src/bot/handlers/pmShow.js
// extracted from case "/pm_show" — no logic changes

export async function handlePmShow({
  bot,
  chatId,
  rest,
  getProjectSection,
}) {
  const section = (rest || "").trim();
  if (!section) {
    await bot.sendMessage(chatId, "Использование: /pm_show <section>");
    return;
  }

  try {
    const rec = await getProjectSection(undefined, section);
    if (!rec) {
      await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
      return;
    }

    await bot.sendMessage(
      chatId,
      `🧠 Project Memory: ${rec.section}\n\n${String(rec.content || "").slice(0, 3500)}`
    );
  } catch (e) {
    console.error("❌ /pm_show error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory.");
  }
}

