// src/bot/handlers/stopTask.js
// extracted from case "/stop_task" — no logic changes

export async function handleStopTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  userRole,
  bypass,
  getTaskRowById,
  isOwnerTaskRow,
  canStopTaskV1,
  updateTaskStatus,
}) {
  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /stop_task <id>");
    return;
  }

  try {
    const taskRow = await getTaskRowById(id);
    if (!taskRow) {
      await bot.sendMessage(chatId, `⚠️ Задача с ID ${id} не найдена.`);
      return;
    }

    const owner = isOwnerTaskRow(taskRow, chatIdStr);

    const allowed = canStopTaskV1({
      userRole,
      bypass,
      taskType: taskRow.type,
      isOwner: owner,
    });

    if (!allowed) {
      await bot.sendMessage(chatId, "⛔ Недостаточно прав для остановки задачи.");
      return;
    }

    await updateTaskStatus(id, "stopped");
    await bot.sendMessage(chatId, `⛔ Задача ${id} остановлена.`);
  } catch (err) {
    console.error("❌ Error in /stop_task:", err);
    await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задачи.");
  }
}

