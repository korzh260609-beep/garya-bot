// src/core/commandPolicy/commandInventorySystem.js
// ============================================================================
// IDENTITY / SYSTEM / ADMIN COMMAND INVENTORY ENTRIES
// ============================================================================
// Purpose:
// - classify identity, group, admin, system and diagnostics slash commands;
// - keep runtime behavior unchanged;
// - prepare migration toward capability-driven Living SG flows.
//
// IMPORTANT:
// - This file is data-only.
// - Do not import handlers here.
// - Do not execute anything here.
// - These commands are Technical Mode / shortcuts, not Living SG intelligence.
// ============================================================================

const MODES = Object.freeze({
  TECHNICAL: "technical_mode",
  USER_SHORTCUT: "user_shortcut",
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
  mode,
  capability,
  actionType,
  riskLevel,
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

function diag(command, capability, dispatcher, riskLevel = RISKS.LOW, extra = {}) {
  return entry({
    command,
    mode: MODES.TECHNICAL,
    capability,
    actionType: ACTION_TYPES.DIAGNOSTIC,
    riskLevel,
    dispatcher,
    notes: "Technical diagnostic shortcut. Not Living SG.",
    ...extra,
  });
}

function read(command, capability, dispatcher, riskLevel = RISKS.LOW, extra = {}) {
  return entry({
    command,
    mode: MODES.TECHNICAL,
    capability,
    actionType: ACTION_TYPES.READ,
    riskLevel,
    dispatcher,
    notes: "Technical read shortcut. Living SG should use meaning/capability later.",
    ...extra,
  });
}

function state(command, capability, dispatcher, riskLevel = RISKS.MEDIUM, extra = {}) {
  return entry({
    command,
    mode: MODES.ADMIN,
    capability,
    actionType: ACTION_TYPES.STATE_CHANGE,
    riskLevel,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: riskLevel === RISKS.HIGH || riskLevel === RISKS.CRITICAL,
    dispatcher,
    notes: "State-changing technical command. Must remain gated and should require confirmation when risky.",
    ...extra,
  });
}

export const SYSTEM_COMMAND_INVENTORY = Object.freeze([
  // --------------------------------------------------------------------------
  // System info / health.
  // --------------------------------------------------------------------------
  read("/health", "system.health", "dispatchSystemInfoCommands", RISKS.LOW, {
    privateOnly: false,
    mode: MODES.USER_SHORTCUT,
  }),
  read("/project_status", "system.project_status", "dispatchSystemInfoCommands", RISKS.LOW, {
    privateOnly: true,
  }),
  diag("/build_info", "system.build_info", "dispatchSystemInfoCommands", RISKS.LOW),

  // --------------------------------------------------------------------------
  // Chat/group source controls.
  // --------------------------------------------------------------------------
  state("/chat_on", "chat.activate", "dispatchIdentityCommands", RISKS.MEDIUM, {
    notes: "Technical chat activation command.",
  }),
  state("/chat_off", "chat.deactivate", "dispatchIdentityCommands", RISKS.MEDIUM, {
    notes: "Technical chat deactivation command.",
  }),
  read("/chat_status", "chat.status", "dispatchIdentityCommands", RISKS.LOW),
  state("/group_source_on", "group_source.enable", "dispatchIdentityCommands", RISKS.MEDIUM),
  state("/group_source_off", "group_source.disable", "dispatchIdentityCommands", RISKS.MEDIUM),
  read("/group_sources", "group_source.list", "dispatchIdentityCommands", RISKS.LOW),
  read("/my_seen_chats", "identity.seen_chats", "dispatchIdentityCommands", RISKS.MEDIUM),
  diag("/group_source_meta", "group_source.meta", "dispatchIdentityCommands", RISKS.LOW),
  diag("/group_source_topic_diag", "group_source.topic_diag", "dispatchIdentityCommands", RISKS.LOW),

  // --------------------------------------------------------------------------
  // Admin grants and users.
  // --------------------------------------------------------------------------
  state("/grant", "access.grant", "dispatchIdentityCommands", RISKS.HIGH),
  state("/revoke", "access.revoke", "dispatchIdentityCommands", RISKS.HIGH),
  read("/grants", "access.grants.list", "dispatchIdentityCommands", RISKS.MEDIUM, {
    monarchOnly: true,
  }),
  diag("/users_stats", "users.stats", "dispatchIdentityCommands", RISKS.MEDIUM, {
    monarchOnly: true,
  }),

  // --------------------------------------------------------------------------
  // Identity diagnostics / maintenance.
  // --------------------------------------------------------------------------
  diag("/identity_diag", "identity.diag", "dispatchIdentityCommands", RISKS.MEDIUM),
  state("/identity_backfill", "identity.backfill", "dispatchIdentityCommands", RISKS.HIGH),
  state("/identity_upgrade_legacy", "identity.upgrade_legacy", "dispatchIdentityCommands", RISKS.HIGH),
  diag("/identity_orphans", "identity.orphans", "dispatchIdentityCommands", RISKS.MEDIUM),
  diag("/identity_legacy_tg", "identity.legacy_tg", "dispatchIdentityCommands", RISKS.MEDIUM),

  // --------------------------------------------------------------------------
  // Diagnostics / utility.
  // --------------------------------------------------------------------------
  diag("/last_errors", "diagnostics.last_errors", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),
  diag("/task_status", "diagnostics.task_status", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/file_logs", "diagnostics.file_logs", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM, {
    monarchOnly: true,
  }),
  diag("/command_policy_diag", "command_policy.diag", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/command_policy_selftest", "command_policy.selftest", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/command_policy_shadow_last", "command_policy.shadow_last", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/intent_action_selftest", "intent_action.selftest", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/meaning_intent_selftest", "meaning_intent.selftest", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/meaning_router_selftest", "meaning_router.selftest", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),

  // --------------------------------------------------------------------------
  // Render diagnostics / bridge-visible utilities.
  // --------------------------------------------------------------------------
  diag("/render_diag", "render.diag", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),
  state("/render_log_set", "render.log_set", "dispatchDiagnosticsUtilityCommands", RISKS.HIGH),
  diag("/render_diag_last", "render.diag_last", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),
  diag("/render_log_show", "render.log_show", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),
  diag("/render_errors_last", "render.errors_last", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),
  diag("/render_deploys_last", "render.deploys_last", "dispatchDiagnosticsUtilityCommands", RISKS.MEDIUM),

  // --------------------------------------------------------------------------
  // Capability diagnostics.
  // --------------------------------------------------------------------------
  read("/capabilities", "capability.registry", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  read("/capability", "capability.lookup", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  read("/cap_diagram", "capability.diagram", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  read("/cap_doc", "capability.document", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  read("/cap_automation", "capability.automation", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
  diag("/vision_diag", "vision.diag", "dispatchDiagnosticsUtilityCommands", RISKS.LOW),
]);

export default SYSTEM_COMMAND_INVENTORY;
