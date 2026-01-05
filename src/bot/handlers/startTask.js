// src/bot/handlers/startTask.js
// extracted from case "/start_task" — no logic changes

export async function handleStartTask({
  bot,
  chatId,
  rest,
  bypass,
  updateTaskStatus,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /start_task <id>");
    return;
  }

  try {
    await updateTaskStatus(id, "active");
    await bot.sendMessage(chatId, `✅ Задача ${id} снова активна.`);
  } catch (err) {
    console.error("❌ Error in /start_task:", err);
    await bot.sendMessage(chatId, "⚠️ Ошибка при запуске задачи.");
  }
}

