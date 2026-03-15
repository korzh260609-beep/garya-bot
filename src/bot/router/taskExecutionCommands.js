// src/bot/router/taskExecutionCommands.js

export async function handleTaskExecutionCommands({
  cmdBase,
  handleRunTask,
  handleStartTask,
  handleStopTask,
  handleStopAllTasks,
  handleRunTaskCmd,
  bot,
  chatId,
  chatIdStr,
  rest,
  access,
  getTaskById,
  runTaskWithAI,
  bypass,
  updateTaskStatus,
  userRole,
  canStopTaskV1,
  callWithFallback,
}) {
  if (cmdBase === "/run_task") {
    await handleRunTask({
      bot,
      chatId,
      chatIdStr,
      rest,
      access,
      getTaskById,
      runTaskWithAI,
    });
    return true;
  }

  if (cmdBase === "/start_task") {
    await handleStartTask({
      bot,
      chatId,
      rest,
      bypass,
      updateTaskStatus,
    });
    return true;
  }

  if (cmdBase === "/stop_task") {
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
    return true;
  }

  if (cmdBase === "/stop_all") {
    await handleStopAllTasks({
      bot,
      chatId,
      bypass,
    });
    return true;
  }

  if (cmdBase === "/run_task_cmd") {
    await handleRunTaskCmd({
      bot,
      chatId,
      chatIdStr,
      rest,
      access,
      callWithFallback,
    });
    return true;
  }

  return false;
}
