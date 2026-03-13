// src/bot/router/startTaskCommand.js

export async function handleStartTaskCommand({
  handleStartTask,
  bot,
  chatId,
  rest,
  bypass,
  updateTaskStatus,
}) {
  await handleStartTask({
    bot,
    chatId,
    rest,
    bypass,
    updateTaskStatus,
  });
}