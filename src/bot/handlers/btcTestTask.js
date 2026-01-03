// src/bot/handlers/btcTestTask.js
// Handler for /btc_test_task — extracted from messageRouter.js with NO behavior changes.

export async function handleBtcTestTask({
  bot,
  chatId,
  chatIdStr,
  access,
  callWithFallback,
  createTestPriceMonitorTask,
}) {
  try {
    const id = await callWithFallback(createTestPriceMonitorTask, [
      [chatIdStr, access],
      [chatIdStr],
    ]);

    await bot.sendMessage(chatId, `🆕 Тест price_monitor создан!\nID: ${id?.id || id}`);
  } catch (e) {
    await bot.sendMessage(chatId, `⛔ ${e?.message || "Запрещено"}`);
  }
}

