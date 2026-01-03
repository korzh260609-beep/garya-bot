// src/bot/handlers/stopAllTasks.js
// Handler for /stop_all_tasks — extracted from messageRouter.js with NO behavior changes.

import pool from "../../../db.js";

export async function handleStopAllTasks({ bot, chatId, bypass }) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const res = await pool.query(`
      UPDATE tasks
      SET status = 'stopped'
      WHERE status = 'active';
    `);

    await bot.sendMessage(
      chatId,
      `⛔ Остановлены все активные задачи.\nИзменено записей: ${res.rowCount}.`
    );
  } catch (err) {
    console.error("❌ Error in /stop_all_tasks:", err);
    await bot.sendMessage(chatId, "⚠️ Ошибка при попытке остановить задачи.");
  }
}

