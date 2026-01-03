// src/bot/handlers/newTask.js
// Handler for /newtask — extracted from messageRouter.js with NO behavior changes.

export async function handleNewTask({
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  createManualTask,
}) {
  try {
    const id = await callWithFallback(createManualTask, [
      [chatIdStr, rest, access],
      [chatIdStr, rest],
    ]);

    await bot.sendMessage(chatId, `🆕 Задача создана!\nID: ${id?.id || id}`);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}

