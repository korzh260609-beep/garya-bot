// src/bot/constants/privateOnlyCommands.js
// ============================================================================
// PRIVATE-ONLY COMMANDS
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// ============================================================================

export const PRIVATE_ONLY_COMMANDS = new Set([
  "/build_info",
  "/chat_meta_debug",
  "/webhook_info",
  "/identity_diag",
  "/identity_backfill",
  "/identity_upgrade_legacy",
  "/identity_orphans",
  "/identity_legacy_tg",

  "/chat_on",
  "/chat_off",
  "/chat_status",

  "/group_source_on",
  "/group_source_off",
  "/group_sources",
  "/my_seen_chats",
  "/group_source_meta",
  "/group_source_topic_diag",

  "/grant",
  "/revoke",
  "/grants",

  "/behavior_events_last",
  "/be_emit",

  "/ta_debug",
  "/ta_debug_full",
  "/ta_snapshot",
  "/ta_snapshot_full",
  "/ta_core",
  "/ta_core_full",

  "/news_rss",
  "/news_rss_full",

  "/multi_monitor",
  "/multi_monitor_full",

  "/crypto_diag",
  "/crypto_diag_full",

  "/cg_vfuse",
  "/cg_vfuse_full",

  "/bn_ticker",
  "/bn_ticker_full",

  "/okx_ticker",
  "/okx_ticker_full",
  "/okx_candles",
  "/okx_candles_full",
  "/okx_snapshot",
  "/okx_snapshot_full",
  "/okx_diag",
  "/okx_diag_full",

  "/file_intake_diag",
  "/file_intake_diag_full",

  "/vision_diag",

  "/memory_status",
  "/memory_diag",
  "/memory_integrity",
  "/memory_backfill",
  "/memory_user_chats",
  "/diag_decision",
  "/diag_decision_last",
  "/diag_decision_stats",
  "/diag_decision_db_stats",
  "/diag_decision_last_db",
  "/diag_decision_window",
  "/diag_decision_promotion",

  "/command_policy_diag",
  "/command_policy_selftest",
  "/command_policy_shadow_last",
  "/intent_action_selftest",
  "/meaning_intent_selftest",
  "/meaning_router_selftest",

  "/pm_set",
  "/pm_list",
  "/pm_session",
  "/pm_session_update",
  "/pm_latest",
  "/pm_digest",
  "/pm_find",
  "/pm_sessions",
  "/pm_session_show",

  "/pm_confirmed_write",
  "/pm_confirmed_update",
  "/pm_confirmed_list",
  "/pm_confirmed_latest",
  "/pm_confirmed_digest",

  "/pm_context",
  "/pm_last",
  "/pm_update",

  "/render_diag",
  "/render_log_set",
  "/render_diag_last",
  "/render_log_show",
  "/render_errors_last",
  "/render_deploys_last",

  "/render_bridge_service",
  "/render_bridge_services",
  "/render_bridge_errors",
  "/render_bridge_logs",
  "/render_bridge_diagnose",
  "/render_bridge_deploys",
  "/render_bridge_deploy",
  "/render_bridge_diag",

  "/agent_workspace_diag",
  "/agent_workspace_run",
  "/agent_workspace_render_report",
  "/agent_workspace_test_note",

  "/reindex",
  "/repo_status",
  "/repo_tree",
  "/repo_file",
  "/repo_analyze",
  "/repo_diff",
  "/repo_search",
  "/repo_get",
  "/repo_check",
  "/repo_review",
  "/repo_review2",
  "/workflow_check",
  "/stage_check",
  "/code_output_status",
  "/project_intent_diag",

  "/capabilities",
  "/capability",
  "/cap_diagram",
  "/cap_doc",
  "/cap_automation",
]);

export default PRIVATE_ONLY_COMMANDS;