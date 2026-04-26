// src/bot/cmdActionMap.js

export const CMD_ACTION = {
  "/profile": "cmd.profile",
  "/me": "cmd.profile",
  "/whoami": "cmd.profile",

  "/mode": "cmd.mode",

  "/confirm_project_action": "cmd.admin.confirm_project_action",

  "/link_start": "cmd.identity.link_start",
  "/link_confirm": "cmd.identity.link_confirm",
  "/link_status": "cmd.identity.link_status",

  "/reindex": "cmd.repo.reindex",
  "/repo_status": "cmd.admin.repo_status",
  "/repo_tree": "cmd.admin.repo_tree",
  "/repo_file": "cmd.admin.repo_file",
  "/repo_search": "cmd.admin.repo_search",
  "/repo_analyze": "cmd.admin.repo_analyze",
  "/repo_diff": "cmd.admin.repo_diff",
  "/repo_get": "cmd.admin.repo_get",
  "/repo_check": "cmd.admin.repo_check",
  "/repo_review": "cmd.admin.repo_review",
  "/repo_review2": "cmd.admin.repo_review2",
  "/workflow_check": "cmd.admin.workflow_check",
  "/stage_check": "cmd.admin.stage_check",

  "/memory_monarch_diag": "cmd.admin.memory_monarch_diag",

  "/tasks": "cmd.tasks.list",
  "/run": "cmd.task.run",
  "/run_task": "cmd.task.run",
  "/newtask": "cmd.task.create",
  "/new_task": "cmd.task.create",
  "/stop_task": "cmd.task.stop",

  "/price": "cmd.price",
  "/prices": "cmd.prices",

  "/sources": "cmd.sources.list",
  "/sources_diag": "cmd.sources.diag",
  "/source": "cmd.source.fetch",
  "/diag_source": "cmd.source.diagnose",
  "/test_source": "cmd.source.test",

  "/pm_set": "cmd.admin.pm_set",
};