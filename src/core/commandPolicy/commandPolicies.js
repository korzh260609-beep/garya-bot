// src/core/commandPolicy/commandPolicies.js
// ============================================================================
// STAGE 7A — Command policy config skeleton
// Purpose:
// - mirror sensitive command rules in a transport-agnostic structure
// - prepare migration away from Telegram-only PRIVATE_ONLY_COMMANDS
// - keep runtime behavior unchanged until dispatcher explicitly adopts this layer
// - do NOT import Telegram bot code here
// - do NOT execute handlers here
// ============================================================================

import { COMMAND_POLICY_SCOPES } from "./CommandPolicyService.js";

function privateCommand(command, scope = COMMAND_POLICY_SCOPES.DEV) {
  return {
    command,
    monarchOnly: false,
    privateOnly: true,
    safePrivateContext: true,
    allowedTransports: [],
    requiresTrustedPath: false,
    scope,
  };
}

function monarchPrivateCommand(command, scope = COMMAND_POLICY_SCOPES.DEV) {
  return {
    command,
    monarchOnly: true,
    privateOnly: true,
    safePrivateContext: true,
    allowedTransports: [],
    requiresTrustedPath: true,
    scope,
  };
}

export const PROJECT_MEMORY_COMMAND_POLICIES = Object.freeze([
  monarchPrivateCommand("/pm_set", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_list", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  monarchPrivateCommand("/pm_session", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  monarchPrivateCommand("/pm_session_update", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_latest", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_digest", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_find", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_sessions", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_session_show", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),

  monarchPrivateCommand("/pm_confirmed_write", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  monarchPrivateCommand("/pm_confirmed_update", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_confirmed_list", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_confirmed_latest", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_confirmed_digest", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),

  privateCommand("/pm_context", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  privateCommand("/pm_last", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
  monarchPrivateCommand("/pm_update", COMMAND_POLICY_SCOPES.PROJECT_MEMORY),
]);

export const PROJECT_REPO_COMMAND_POLICIES = Object.freeze([
  monarchPrivateCommand("/reindex", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_status", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_tree", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_file", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_analyze", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_diff", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_search", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_get", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_check", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_review", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/repo_review2", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/workflow_check", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/stage_check", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/code_output_status", COMMAND_POLICY_SCOPES.PROJECT_REPO),
  monarchPrivateCommand("/project_intent_diag", COMMAND_POLICY_SCOPES.PROJECT_REPO),
]);

export const MEMORY_DIAGNOSTIC_COMMAND_POLICIES = Object.freeze([
  privateCommand("/memory_status", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/memory_diag", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  monarchPrivateCommand("/memory_integrity", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  monarchPrivateCommand("/memory_backfill", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/memory_user_chats", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_last", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_stats", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_db_stats", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_last_db", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_window", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
  privateCommand("/diag_decision_promotion", COMMAND_POLICY_SCOPES.MEMORY_DIAGNOSTICS),
]);

export const SOURCE_COMMAND_POLICIES = Object.freeze([
  privateCommand("/news_rss", COMMAND_POLICY_SCOPES.SOURCES),
  privateCommand("/news_rss_full", COMMAND_POLICY_SCOPES.SOURCES),
  privateCommand("/file_intake_diag", COMMAND_POLICY_SCOPES.SOURCES),
  privateCommand("/file_intake_diag_full", COMMAND_POLICY_SCOPES.SOURCES),
  privateCommand("/vision_diag", COMMAND_POLICY_SCOPES.SOURCES),
]);

export const SYSTEM_COMMAND_POLICIES = Object.freeze([
  privateCommand("/build_info", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/chat_meta_debug", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/webhook_info", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/identity_diag", COMMAND_POLICY_SCOPES.SYSTEM),
  monarchPrivateCommand("/identity_backfill", COMMAND_POLICY_SCOPES.SYSTEM),
  monarchPrivateCommand("/identity_upgrade_legacy", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/identity_orphans", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/identity_legacy_tg", COMMAND_POLICY_SCOPES.SYSTEM),

  privateCommand("/chat_on", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/chat_off", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/chat_status", COMMAND_POLICY_SCOPES.SYSTEM),

  privateCommand("/group_source_on", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/group_source_off", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/group_sources", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/my_seen_chats", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/group_source_meta", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/group_source_topic_diag", COMMAND_POLICY_SCOPES.SYSTEM),

  monarchPrivateCommand("/grant", COMMAND_POLICY_SCOPES.SYSTEM),
  monarchPrivateCommand("/revoke", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/grants", COMMAND_POLICY_SCOPES.SYSTEM),

  privateCommand("/behavior_events_last", COMMAND_POLICY_SCOPES.SYSTEM),
  monarchPrivateCommand("/be_emit", COMMAND_POLICY_SCOPES.SYSTEM),

  privateCommand("/profile", COMMAND_POLICY_SCOPES.SYSTEM),
  privateCommand("/mode", COMMAND_POLICY_SCOPES.SYSTEM),
]);

export const DEV_COMMAND_POLICIES = Object.freeze([
  privateCommand("/ta_debug", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/ta_debug_full", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/ta_snapshot", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/ta_snapshot_full", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/ta_core", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/ta_core_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/multi_monitor", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/multi_monitor_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/crypto_diag", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/crypto_diag_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/cg_vfuse", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/cg_vfuse_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/bn_ticker", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/bn_ticker_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/okx_ticker", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_ticker_full", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_candles", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_candles_full", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_snapshot", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_snapshot_full", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_diag", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/okx_diag_full", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/render_diag", COMMAND_POLICY_SCOPES.DEV),
  monarchPrivateCommand("/render_log_set", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_diag_last", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_log_show", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_errors_last", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_deploys_last", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/render_bridge_service", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_services", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_errors", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_logs", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_diagnose", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_deploys", COMMAND_POLICY_SCOPES.DEV),
  monarchPrivateCommand("/render_bridge_deploy", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/render_bridge_diag", COMMAND_POLICY_SCOPES.DEV),

  privateCommand("/capabilities", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/capability", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/cap_diagram", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/cap_doc", COMMAND_POLICY_SCOPES.DEV),
  privateCommand("/cap_automation", COMMAND_POLICY_SCOPES.DEV),
]);

export const COMMAND_POLICIES = Object.freeze([
  ...PROJECT_MEMORY_COMMAND_POLICIES,
  ...PROJECT_REPO_COMMAND_POLICIES,
  ...MEMORY_DIAGNOSTIC_COMMAND_POLICIES,
  ...SOURCE_COMMAND_POLICIES,
  ...SYSTEM_COMMAND_POLICIES,
  ...DEV_COMMAND_POLICIES,
]);

export default COMMAND_POLICIES;
