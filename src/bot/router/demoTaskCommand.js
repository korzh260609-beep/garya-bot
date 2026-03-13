// src/bot/router/demoTaskCommand.js

export async function handleDemoTaskCommand({
  handleDemoTask,
  bot,
  chatId,
  chatIdStr,
  access,
  callWithFallback,
  createDemoTask,
}) {
  await handleDemoTask({
    bot,
    chatId,
    chatIdStr,
    access,
    callWithFallback,
    createDemoTask,
  });
}