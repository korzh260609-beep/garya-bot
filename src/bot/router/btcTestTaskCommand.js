// src/bot/router/btcTestTaskCommand.js

export async function handleBtcTestTaskCommand({
  handleBtcTestTask,
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  createTestPriceMonitorTask,
}) {
  await handleBtcTestTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    access,
    callWithFallback,
    createTestPriceMonitorTask,
  });
}