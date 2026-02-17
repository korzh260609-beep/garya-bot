// src/bot/handlers/runTask.js
// Handler for /run_task — identity-first compatible.

export async function handleRunTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  getTaskById,
  runTaskWithAI,
}) {
  try {
    const raw = String(rest || "").trim();
    const taskId = parseInt(raw, 10);

    if (!raw || Number.isNaN(taskId)) {
      await bot.sendMessage(chatId, "Использование: /run_task <id>");
      return;
    }

    const task = await getTaskById(chatIdStr, taskId, access);

    if (!task) {
      await bot.sendMessage(chatId, `⛔ Задача #${taskId} не найдена`);
      return;
    }

    await runTaskWithAI(task, chatId, bot, access);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}
