// src/bot/router/taskListCommands.js

export async function handleTaskListCommands({
  cmdBase,
  handleDemoTaskCommand,
  handleNewTaskCommand,
  handleBtcTestTaskCommand,
  handleTasksCommand,
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
    await handleDemoTaskCommand({
      handleDemoTask,
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
    await handleNewTaskCommand({
      handleNewTask,
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
    await handleBtcTestTaskCommand({
      handleBtcTestTask,
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
    await handleTasksCommand({
      handleTasksList,
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