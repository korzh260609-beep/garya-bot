// src/bot/router/tasksCommand.js

export async function handleTasksCommand({
  handleTasksList,
  bot,
  chatId,
  chatIdStr,
  getUserTasks,
  access,
}) {
  await handleTasksList({
    bot,
    chatId,
    chatIdStr,
    getUserTasks,
    access,
  });
}