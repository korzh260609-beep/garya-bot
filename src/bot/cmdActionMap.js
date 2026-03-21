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
  "/repo_status": "cmd.admin.repo_status",
  "/workflow_check": "cmd.admin.workflow_check",

  "/tasks": "cmd.tasks.list",
  "/run": "cmd.task.run",
  "/newtask": "cmd.task.create",

  "/price": "cmd.price",
  "/prices": "cmd.prices",

  "/sources": "cmd.sources.list",
  "/source": "cmd.source.fetch",
  "/diag_source": "cmd.source.diagnose",
  "/test_source": "cmd.source.test",

  // ✅ STAGE 10C.29 / 10C.36 / 10C.38 — TA debug/snapshot/core commands (monarch/dev)
  "/ta_debug": "cmd.admin.ta_debug",
  "/ta_debug_full": "cmd.admin.ta_debug",
  "/ta_snapshot": "cmd.admin.ta_snapshot",
  "/ta_snapshot_full": "cmd.admin.ta_snapshot",
  "/ta_core": "cmd.admin.ta_core",
  "/ta_core_full": "cmd.admin.ta_core",

  // ✅ STAGE 10C.8 — News RSS debug commands (monarch/dev)
  "/news_rss": "cmd.admin.news_rss",
  "/news_rss_full": "cmd.admin.news_rss",

  // ✅ STAGE 10C.9 — Multi-monitor debug commands (monarch/dev)
  "/multi_monitor": "cmd.admin.multi_monitor",
  "/multi_monitor_full": "cmd.admin.multi_monitor",

  // ✅ STAGE 10C.10 — Crypto diagnostics commands (monarch/dev)
  "/crypto_diag": "cmd.admin.crypto_diag",
  "/crypto_diag_full": "cmd.admin.crypto_diag",

  // ✅ STAGE 10C.11 — CG V-Fuse commands (monarch/dev)
  "/cg_vfuse": "cmd.admin.cg_vfuse",
  "/cg_vfuse_full": "cmd.admin.cg_vfuse",

  // ✅ STAGE 10D.1 — Binance ticker debug commands (monarch/dev)
  "/bn_ticker": "cmd.admin.bn_ticker",
  "/bn_ticker_full": "cmd.admin.bn_ticker",

  // ✅ STAGE 10D-alt.1 — OKX ticker debug commands (monarch/dev)
  "/okx_ticker": "cmd.admin.okx_ticker",
  "/okx_ticker_full": "cmd.admin.okx_ticker",

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

  "/identity_upgrade_legacy": "cmd.admin.identity_upgrade_legacy",
  "/identity_orphans": "cmd.admin.identity_orphans",
  "/identity_legacy_tg": "cmd.admin.identity_legacy_tg",

  "/stop_all_tasks": "cmd.admin.stop_all_tasks",
  "/start_task": "cmd.admin.start_task",
  "/stop_tasks_type": "cmd.admin.stop_tasks_type",
  "/users_stats": "cmd.admin.users_stats",
  "/file_logs": "cmd.admin.file_logs",
  "/pm_set": "cmd.admin.pm_set",

  "/memory_longterm_diag": "cmd.admin.memory_longterm_diag",
  "/memory_type_stats": "cmd.admin.memory_type_stats",
  "/memory_fetch_type": "cmd.admin.memory_fetch_type",
  "/memory_fetch_key": "cmd.admin.memory_fetch_key",
  "/memory_summary_service": "cmd.admin.memory_summary_service",
  "/memory_select_context": "cmd.admin.memory_select_context",
  "/memory_reclassify_explicit": "cmd.admin.memory_reclassify_explicit",

  "/ar_create_test": "cmd.admin.ar_create_test",
  "/ar_list": "cmd.admin.ar_list",
};