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

  // ✅ STAGE 11.13 — Recall role gate
  "/recall": "cmd.recall",
  "/recall_more": "cmd.recall",

  // ✅ STAGE 4.3 — Chat Gate admin (monarch)
  "/chat_on": "cmd.admin.chat_set_active",
  "/chat_off": "cmd.admin.chat_set_active",
  "/chat_status": "cmd.admin.chat_status",

  // ✅ STAGE 7B.9 / 11.18 — Group Source admin (monarch, skeleton)
  "/group_source_on": "cmd.admin.group_source_set",
  "/group_source_off": "cmd.admin.group_source_set",
  "/group_sources": "cmd.admin.group_source_status",

  // ✅ STAGE 11.12 — Grants admin (monarch)
  "/grant": "cmd.admin.grant",
  "/revoke": "cmd.admin.revoke",
  "/grants": "cmd.admin.grants",

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

  // Stage 4.5 — list orphan users without identity rows (monarch/dev)
  "/identity_orphans": "cmd.admin.identity_orphans",

  // Stage 4.5 — list legacy tg:* users (monarch/dev)
  "/identity_legacy_tg": "cmd.admin.identity_legacy_tg",

  "/stop_all_tasks": "cmd.admin.stop_all_tasks",
  "/start_task": "cmd.admin.start_task",
  "/stop_tasks_type": "cmd.admin.stop_tasks_type",
  "/users_stats": "cmd.admin.users_stats",
  "/file_logs": "cmd.admin.file_logs",
  "/pm_set": "cmd.admin.pm_set",

  "/ar_create_test": "cmd.admin.ar_create_test",
  "/ar_list": "cmd.admin.ar_list",
};