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
// - /stop_task
// - /start_task
// - /stop_all_tasks
// - /stop_all (legacy alias routed through main path)
// - /stop_tasks_type
//
// Legacy-only execution command /run_task_cmd was removed from active routing
// because it is no longer part of the supported task contract.
//
// Rule:
// - do NOT handle /run_task here anymore
// - do NOT handle /stop_task here anymore
// - do NOT handle /start_task here anymore
// - do NOT handle /stop_all here anymore
// - do NOT re-introduce /run_task_cmd without explicit contract decision
// ----------------------------------------------------------------------------

export async function handleTaskExecutionCommands() {
  return false;
}