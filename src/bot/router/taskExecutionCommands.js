// src/bot/router/taskExecutionCommands.js
//
// LEGACY TASK EXECUTION SHIM
// ----------------------------------------------------------------------------
// Main-path task execution commands are handled through:
//
//   CMD_ACTION -> requirePermOrReply -> dispatchCommand -> task handlers
//
// Current source of truth for active main-path task execution commands:
// - /run
// - /run_task (legacy alias routed through main path)
// - /start_task
// - /stop_all_tasks
// - /stop_all (legacy alias routed through main path)
// - /stop_tasks_type
//
// This legacy router block must remain only for old task execution commands that
// are not yet migrated to CMD_ACTION.
//
// Rule:
// - do NOT handle /run_task here anymore
// - do NOT handle /start_task here anymore
// - do NOT handle /stop_all here anymore
// - keep only legacy-only execution commands until they are migrated or removed
// ----------------------------------------------------------------------------

import { handleStopTask } from "../handlers/stopTask.js";
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
  bypass,
  updateTaskStatus,
  userRole,
}) {
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