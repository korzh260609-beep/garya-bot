// src/bot/handlers/runTask.js
// Handler for /run — extracted from messageRouter.js with NO behavior changes.

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
    const result = await callWithFallback(runTask, [
      [bot, chatId, chatIdStr, rest, access],
      [bot, chatId, chatIdStr, rest],
      [chatIdStr, rest, access],
      [chatIdStr, rest],
    ]);

    // keep same output shape as before: stringify object or show as-is
    if (typeof result === "string") {
      await bot.sendMessage(chatId, result);
    } else {
      await bot.sendMessage(chatId, `✅ ${JSON.stringify(result)}`);
    }
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}
