// src/bot/router/newTaskCommand.js

export async function handleNewTaskCommand({
  handleNewTask,
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  callWithFallback,
  createManualTask,
}) {
  await handleNewTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    access,
    callWithFallback,
    createManualTask,
  });
}