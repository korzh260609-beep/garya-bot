// src/core/commandPolicy/commandInventoryOpsCrypto.js
// ============================================================================
// OPS / RENDER BRIDGE / AGENT WORKSPACE / CRYPTO DEV COMMAND INVENTORY ENTRIES
// ============================================================================
// Purpose:
// - classify ops/dev/crypto diagnostic slash commands as Technical Mode;
// - keep runtime behavior unchanged;
// - prepare migration toward capability-driven Living SG flows.
//
// IMPORTANT:
// - This file is data-only.
// - Do not import handlers here.
// - Do not execute anything here.
// - These commands are Technical Mode / diagnostics, not Living SG intelligence.
// ============================================================================

const MODES = Object.freeze({
  TECHNICAL: "technical_mode",
  ADMIN: "admin_technical_mode",
});

const ACTION_TYPES = Object.freeze({
  READ: "read",
  STATE_CHANGE: "state_change",
  EXTERNAL_ACTION: "external_action",
  DIAGNOSTIC: "diagnostic",
});

const RISKS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

function entry({
  command,
  mode = MODES.TECHNICAL,
  capability,
  actionType = ACTION_TYPES.DIAGNOSTIC,
  riskLevel = RISKS.LOW,
  monarchOnly = false,
  privateOnly = true,
  requiresConfirmation = false,
  dispatcher,
  handler = null,
  notes = "",
}) {
  return Object.freeze({
    command,
    mode,
    capability,
    actionType,
    riskLevel,
    monarchOnly,
    privateOnly,
    requiresConfirmation,
    dispatcher,
    handler,
    notes,
  });
}

function adminOp(command, capability, dispatcher, riskLevel = RISKS.HIGH, extra = {}) {
  return entry({
    command,
    mode: MODES.ADMIN,
    capability,
    actionType: ACTION_TYPES.EXTERNAL_ACTION,
    riskLevel,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: true,
    dispatcher,
    notes: "High-risk technical ops command. Must remain monarch/private and confirmation-gated before runtime hardening.",
    ...extra,
  });
}

function diag(command, capability, dispatcher, riskLevel = RISKS.LOW, extra = {}) {
  return entry({
    command,
    capability,
    actionType: ACTION_TYPES.DIAGNOSTIC,
    riskLevel,
    dispatcher,
    notes: "Technical diagnostic shortcut. Not Living SG.",
    ...extra,
  });
}

export const OPS_CRYPTO_COMMAND_INVENTORY = Object.freeze([
  // --------------------------------------------------------------------------
  // Render Bridge ops.
  // --------------------------------------------------------------------------
  diag("/render_bridge_service", "render_bridge.service", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  diag("/render_bridge_services", "render_bridge.services", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  diag("/render_bridge_errors", "render_bridge.errors", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  diag("/render_bridge_logs", "render_bridge.logs", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  diag("/render_bridge_diagnose", "render_bridge.diagnose", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  diag("/render_bridge_deploys", "render_bridge.deploys", "dispatchRenderBridgeCommands", RISKS.MEDIUM),
  adminOp("/render_bridge_deploy", "render_bridge.deploy", "dispatchRenderBridgeCommands", RISKS.CRITICAL, {
    notes: "Can trigger Render deploy. Critical Technical Mode command.",
  }),
  diag("/render_bridge_diag", "render_bridge.diag", "dispatchRenderBridgeCommands", RISKS.MEDIUM),

  // --------------------------------------------------------------------------
  // Agent Workspace.
  // --------------------------------------------------------------------------
  diag("/agent_workspace_diag", "agent_workspace.diag", "dispatchAgentWorkspaceCommands", RISKS.MEDIUM),
  adminOp("/agent_workspace_run", "agent_workspace.run", "dispatchAgentWorkspaceCommands", RISKS.HIGH, {
    actionType: ACTION_TYPES.STATE_CHANGE,
    notes: "Runs AgentWorkspace technical action. Must remain controlled.",
  }),
  diag("/agent_workspace_render_report", "agent_workspace.render_report", "dispatchAgentWorkspaceCommands", RISKS.MEDIUM),
  adminOp("/agent_workspace_test_note", "agent_workspace.test_note", "dispatchAgentWorkspaceCommands", RISKS.MEDIUM, {
    actionType: ACTION_TYPES.STATE_CHANGE,
    notes: "Writes/creates test note through AgentWorkspace surface.",
  }),

  // --------------------------------------------------------------------------
  // Crypto / market dev diagnostics.
  // --------------------------------------------------------------------------
  diag("/ta_debug", "crypto.ta_debug", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/ta_debug_full", "crypto.ta_debug_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/ta_snapshot", "crypto.ta_snapshot", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/ta_snapshot_full", "crypto.ta_snapshot_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/ta_core", "crypto.ta_core", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/ta_core_full", "crypto.ta_core_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/news_rss", "crypto.news_rss", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/news_rss_full", "crypto.news_rss_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/multi_monitor", "crypto.multi_monitor", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/multi_monitor_full", "crypto.multi_monitor_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/crypto_diag", "crypto.diag", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/crypto_diag_full", "crypto.diag_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/cg_vfuse", "crypto.coingecko_vfuse", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/cg_vfuse_full", "crypto.coingecko_vfuse_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/bn_ticker", "crypto.binance_ticker", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/bn_ticker_full", "crypto.binance_ticker_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_ticker", "crypto.okx_ticker", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_ticker_full", "crypto.okx_ticker_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_candles", "crypto.okx_candles", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_candles_full", "crypto.okx_candles_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_snapshot", "crypto.okx_snapshot", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_snapshot_full", "crypto.okx_snapshot_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_diag", "crypto.okx_diag", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/okx_diag_full", "crypto.okx_diag_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),

  // --------------------------------------------------------------------------
  // File intake diagnostics.
  // --------------------------------------------------------------------------
  diag("/file_intake_diag", "file_intake.diag", "dispatchCryptoDevCommands", RISKS.MEDIUM),
  diag("/file_intake_diag_full", "file_intake.diag_full", "dispatchCryptoDevCommands", RISKS.MEDIUM),
]);

export default OPS_CRYPTO_COMMAND_INVENTORY;
