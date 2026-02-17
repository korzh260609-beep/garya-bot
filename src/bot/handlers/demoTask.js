// src/bot/handlers/demoTask.js
// Handler for /demo_task — identity-first compatible.

export async function handleDemoTask({
  bot,
  chatId,
  chatIdStr,
  access,
  callWithFallback,
  createDemoTask,
}) {
  try {
    const id = await callWithFallback(createDemoTask, [
      [chatIdStr, access],
      [chatIdStr],
    ]);

    await bot.sendMessage(chatId, `✅ Демо-задача создана!\nID: ${id?.id || id}`);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}
