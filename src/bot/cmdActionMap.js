// src/bot/cmdActionMap.js

export const CMD_ACTION = {
  "/profile": "cmd.profile",
  "/me": "cmd.profile",
  "/whoami": "cmd.profile",

  "/mode": "cmd.mode",

  "/reindex": "cmd.repo.reindex",

  "/tasks": "cmd.tasks.list",
  "/run": "cmd.task.run",
  "/newtask": "cmd.task.create",

  "/price": "cmd.price",
  "/prices": "cmd.prices",

  "/sources": "cmd.sources.list",
  "/source": "cmd.source.fetch",
  "/diag_source": "cmd.source.diagnose",
  "/test_source": "cmd.source.test",

  // Stage 5/6 — admin/dev (must go via can())
  "/health": "cmd.admin.health",
  "/project_status": "cmd.admin.project_status",

  "/stop_all_tasks": "cmd.admin.stop_all_tasks",
  "/start_task": "cmd.admin.start_task",
  "/stop_tasks_type": "cmd.admin.stop_tasks_type",
  "/users_stats": "cmd.admin.users_stats",
  "/file_logs": "cmd.admin.file_logs",
  "/pm_set": "cmd.admin.pm_set",

  "/ar_create_test": "cmd.admin.ar_create_test",
  "/ar_list": "cmd.admin.ar_list",
};
