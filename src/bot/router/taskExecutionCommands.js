// src/bot/router/taskExecutionCommands.js

import { handleRunTask } from "../handlers/runTask.js";
import { handleStartTask } from "../handlers/startTask.js";
import { handleStopTask } from "../handlers/stopTask.js";
import { handleStopAllTasks } from "../handlers/stopAllTasks.js";
import { handleRunTaskCmd } from "../handlers/runTaskCmd.js";
import { canStopTaskV1, callWithFallback } from "../../../core/helpers.js";

export async function handleTaskExecutionCommands({
  cmdBase,
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