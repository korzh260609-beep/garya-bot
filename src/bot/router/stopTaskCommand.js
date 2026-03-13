// src/bot/router/stopTaskCommand.js

export async function handleStopTaskCommand({
  handleStopTask,
  bot,
  chatId,
  chatIdStr,
  rest,
  userRole,
  bypass,
  getTaskById,
  canStopTaskV1,
  updateTaskStatus,
  access,
}) {
  await handleStopTask({
    bot,
    chatId,
    chatIdStr,
    rest,
    userRole,
    bypass,
    getTaskById,
    canStopTaskV1,
    updateTaskStatus,
    access,
  });
}