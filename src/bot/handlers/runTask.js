// src/bot/handlers/runTask.js
// Handler for /run — extracted from messageRouter.js with NO behavior changes.

import { getTaskById, runTaskWithAI } from "../../tasks/taskEngine.js";

export async function handleRunTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  runTask,
}) {
  try {
    const raw = String(rest || "").trim();
    const taskId = parseInt(raw, 10);

    if (!raw || Number.isNaN(taskId)) {
      await bot.sendMessage(chatId, "Использование: /run <id>");
      return;
    }

    const task = await getTaskById(chatIdStr, taskId);

    if (!task) {
      await bot.sendMessage(chatId, `⛔ Задача #${taskId} не найдена`);
      return;
    }

    // Task Engine expects: (task, chatId, bot, access)
    await runTaskWithAI(task, chatId, bot, access);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}
