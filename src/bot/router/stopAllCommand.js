// src/bot/router/stopAllCommand.js

export async function handleStopAllCommand({
  handleStopAllTasks,
  bot,
  chatId,
  bypass,
}) {
  await handleStopAllTasks({
    bot,
    chatId,
    bypass,
  });
}