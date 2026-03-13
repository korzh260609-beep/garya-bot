// src/bot/router/runTaskCommand.js

export async function handleRunTaskCommand({
  handleRunTask,
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  getTaskById,
  runTaskWithAI,
}) {
  await handleRunTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    access,
    getTaskById,
    runTaskWithAI,
  });
}