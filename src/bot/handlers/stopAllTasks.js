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
      WHERE status = 'active'
      RETURNING id, type;
    `);

    const count = res.rowCount || 0;

    // Короткая сводка по типам (без спама)
    const byType = {};
    for (const r of res.rows || []) {
      const t = r.type || "unknown";
      byType[t] = (byType[t] || 0) + 1;
    }

    const summary =
      Object.keys(byType).length > 0
        ? "\n" +
          Object.entries(byType)
            .map(([t, n]) => `- ${t}: ${n}`)
            .join("\n")
        : "";

    await bot.sendMessage(
      chatId,
      `⛔ Остановлены все активные задачи.\nИзменено записей: ${count}.${summary}`
    );
  } catch (err) {
    console.error("❌ Error in /stop_all_tasks:", err);
    await bot.sendMessage(
      chatId,
      `⚠️ Ошибка при попытке остановить задачи: ${String(err?.message || err).slice(0, 200)}`
    );
  }
}
