// src/bot/handlers/stopTask.js
// identity-first version (Stage 4)

export async function handleStopTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  userRole,
  bypass,
  getTaskById,
  canStopTaskV1,
  updateTaskStatus,
  access, // identity pack
}) {
  const id = Number((rest || "").trim());
  if (!id) {
    await bot.sendMessage(chatId, "Использование: /stop_task <id>");
    return;
  }

  try {
    // identity-first lookup
    const taskRow = await getTaskById(chatIdStr, id, access);

    if (!taskRow) {
      await bot.sendMessage(chatId, `⚠️ Задача с ID ${id} не найдена.`);
      return;
    }

    // identity-first owner check
    const isOwner =
      String(taskRow.user_global_id || "") ===
      String(access?.user?.global_user_id || "");

    const allowed = canStopTaskV1({
      userRole,
      bypass,
      taskType: taskRow.type,
      isOwner,
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
