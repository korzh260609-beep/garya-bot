// src/bot/router/taskListCommands.js

export async function handleTaskListCommands({
  cmdBase,
  handleDemoTask,
  handleNewTask,
  handleBtcTestTask,
  handleTasksList,
  bot,
  chatId,
  chatIdStr,
  rest,
  accessPack,
  callWithFallback,
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