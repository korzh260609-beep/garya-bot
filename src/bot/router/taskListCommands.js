// src/bot/router/taskListCommands.js
//
// LEGACY TASK LIST / CREATE SHIM
// ----------------------------------------------------------------------------
// Main user-facing task commands were moved to the main command path:
//
//   CMD_ACTION -> requirePermOrReply -> dispatchCommand -> task handlers
//
// Current source of truth for active main-path task commands:
// - /tasks
// - /newtask
// - /new_task (legacy alias routed through main path)
//
// This legacy router block must remain only for old dev-style task commands that
// are not yet migrated to CMD_ACTION.
//
// Rule:
// - do NOT handle /tasks here anymore
// - do NOT handle /new_task here anymore
// - keep only legacy-only commands until they are migrated or removed
// ----------------------------------------------------------------------------

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
  createTestPriceMonitorTask,
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

  return false;
}