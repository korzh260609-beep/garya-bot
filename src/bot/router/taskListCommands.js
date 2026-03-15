// src/bot/router/taskListCommands.js

import { handleTasksList } from "../handlers/tasksList.js";
import { handleNewTask } from "../handlers/newTask.js";
import { handleBtcTestTask } from "../handlers/btcTestTask.js";
import { handleDemoTask } from "../handlers/demoTask.js";
import { callWithFallback } from "../../../core/helpers.js";

export async function handleTaskListCommands({
  cmdBase,
  bot,
  chatId,
  chatIdStr,
  rest,
  accessPack,
  createDemoTask,
  createManualTask,
  createTestPriceMonitorTask,
  getUserTasks,
}) {
  if (cmdBase === "/demo_task") {
    await handleDemoTask({
      bot,
      chatId,
      chatIdStr,
      access: accessPack,
      callWithFallback,
      createDemoTask,
    });
    return true;
  }

  if (cmdBase === "/new_task") {
    await handleNewTask({
      bot,
      chatId,
      chatIdStr,
      rest,
      access: accessPack,
      callWithFallback,
      createManualTask,
    });
    return true;
  }

  if (cmdBase === "/btc_test_task") {
    await handleBtcTestTask({
      bot,
      chatId,
      chatIdStr,
      rest,
      access: accessPack,
      callWithFallback,
      createTestPriceMonitorTask,
    });
    return true;
  }

  if (cmdBase === "/tasks") {
    await handleTasksList({
      bot,
      chatId,
      chatIdStr,
      getUserTasks,
      access: accessPack,
    });
    return true;
  }

  return false;
}