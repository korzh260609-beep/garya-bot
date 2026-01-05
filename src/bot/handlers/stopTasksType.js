// src/bot/handlers/stopTasksType.js
// extracted from case "/stop_tasks_type" — no logic changes

export async function handleStopTasksType({
  bot,
  chatId,
  rest,
  bypass,
  pool,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  const taskType = (rest || "").trim();
  if (!taskType) {
    await bot.sendMessage(
      chatId,
      'Использование: /stop_tasks_type <type>\nНапример: /stop_tasks_type price_monitor'
    );
    return;
  }

  try {
    const res = await pool.query(
      `UPDATE tasks SET status = 'stopped' WHERE type = $1 AND status = 'active';`,
      [taskType]
    );

    await bot.sendMessage(
      chatId,
      `⛔ Остановлены все активные задачи типа "${taskType}".\nИзменено записей: ${res.rowCount}.`
    );
  } catch (err) {
    console.error("❌ Error /stop_tasks_type:", err);
    await bot.sendMessage(chatId, "⚠️ Ошибка при остановке задач по типу.");
  }
}

