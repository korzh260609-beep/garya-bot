// src/bot/cmdActionMap.js

export const CMD_ACTION = {
  "/profile": "cmd.profile",
  "/me": "cmd.profile",
  "/whoami": "cmd.profile",

  "/mode": "cmd.mode",

  "/link_start": "cmd.identity.link_start",
  "/link_confirm": "cmd.identity.link_confirm",
  "/link_status": "cmd.identity.link_status",

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

  // ✅ STAGE 4.3 — Chat Gate admin (monarch)
  "/chat_on": "cmd.admin.chat_set_active",
  "/chat_off": "cmd.admin.chat_set_active",
  "/chat_status": "cmd.admin.chat_status",

  // Stage 5/6 — admin/dev (must go via can())
  "/health": "cmd.admin.health",
  "/webhook_info": "cmd.admin.webhook_info",
  "/last_errors": "cmd.admin.last_errors",
  "/task_status": "cmd.admin.task_status",
  "/project_status": "cmd.admin.project_status",

  "/identity_diag": "cmd.admin.identity_diag",
  "/identity_backfill": "cmd.admin.identity_backfill",

  // Stage 4.5 — legacy global_user_id upgrade (monarch/dev)
  "/identity_upgrade_legacy": "cmd.admin.identity_upgrade_legacy",

  "/stop_all_tasks": "cmd.admin.stop_all_tasks",
  "/start_task": "cmd.admin.start_task",
  "/stop_tasks_type": "cmd.admin.stop_tasks_type",
  "/users_stats": "cmd.admin.users_stats",
  "/file_logs": "cmd.admin.file_logs",
  "/pm_set": "cmd.admin.pm_set",

  "/ar_create_test": "cmd.admin.ar_create_test",
  "/ar_list": "cmd.admin.ar_list",
};
