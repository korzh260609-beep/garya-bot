// src/bot/router/taskListCommands.js
//
// LEGACY TASK LIST / CREATE SHIM
// ----------------------------------------------------------------------------
// Main user-facing task commands are handled through:
//
//   CMD_ACTION -> requirePermOrReply -> dispatchCommand -> task handlers
//
// Current source of truth for active main-path task commands:
// - /tasks
// - /newtask
// - /new_task (legacy alias routed through main path)
//
// Legacy-only dev task commands /demo_task and /btc_test_task were removed from
// active routing because they are no longer part of the supported task contract.
//
// Rule:
// - do NOT handle /tasks here anymore
// - do NOT handle /new_task here anymore
// - do NOT re-introduce /demo_task or /btc_test_task without explicit contract decision
// ----------------------------------------------------------------------------

export async function handleTaskListCommands() {
  return false;
}