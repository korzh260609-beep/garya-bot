// src/core/commandPolicy/commandInventoryDiagnosticsLegacy.js
// ============================================================================
// DIAGNOSTICS / RECALL / LEGACY COMMAND INVENTORY ENTRIES
// ============================================================================
// Purpose:
// - classify remaining explicit diagnostic, recall and legacy slash commands;
// - keep runtime behavior unchanged;
// - complete the current command inventory coverage pass.
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
  DIAGNOSTIC: "diagnostic",
});

const RISKS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
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

function read(command, capability, dispatcher, riskLevel = RISKS.LOW, extra = {}) {
  return entry({
    command,
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
    requiresConfirmation: riskLevel === RISKS.HIGH,
    dispatcher,
    notes: "State-changing technical command. Must remain gated before runtime hardening.",
    ...extra,
  });
}

export const DIAGNOSTICS_LEGACY_COMMAND_INVENTORY = Object.freeze([
  // --------------------------------------------------------------------------
  // Meta/debug/webhook/behavior diagnostics.
  // --------------------------------------------------------------------------
  diag("/chat_meta_debug", "meta.chat_debug", "dispatchMetaDebugCommands", RISKS.MEDIUM),
  diag("/webhook_info", "meta.webhook_info", "dispatchMetaDebugCommands", RISKS.LOW),
  diag("/behavior_events_last", "behavior.events_last", "dispatchMetaDebugCommands", RISKS.MEDIUM),
  state("/be_emit", "behavior.event_emit", "dispatchMetaDebugCommands", RISKS.HIGH, {
    notes: "Can emit behavior event. Technical Mode only; keep monarch/private and confirmation-gated in future hardening.",
  }),

  // --------------------------------------------------------------------------
  // Recall/manual memory lookup.
  // --------------------------------------------------------------------------
  read("/recall", "memory.recall", "dispatchRecallCommands", RISKS.MEDIUM, {
    notes: "Manual recall shortcut. Living SG recall should go through memory capability and context policy.",
  }),
  read("/recall_more", "memory.recall_more", "dispatchRecallCommands", RISKS.MEDIUM, {
    notes: "Manual recall pagination/continuation shortcut. Technical Mode / user shortcut only.",
  }),

  // --------------------------------------------------------------------------
  // Legacy/local commands.
  // --------------------------------------------------------------------------
  read("/ar_list", "legacy.ar_list", "dispatchLegacyLocalCommands", RISKS.LOW, {
    notes: "Legacy/local command. Keep as Technical Mode until removed or migrated.",
  }),
  entry({
    command: "/help",
    mode: MODES.USER_SHORTCUT,
    capability: "help.show",
    actionType: ACTION_TYPES.READ,
    riskLevel: RISKS.LOW,
    privateOnly: false,
    dispatcher: "dispatchLegacyLocalCommands",
    notes: "User help shortcut. Does not define Living SG intelligence.",
  }),

  // --------------------------------------------------------------------------
  // Decision diagnostics.
  // --------------------------------------------------------------------------
  diag("/diag_decision", "decision.diag", "dispatchDecisionDiagnosticsCommands", RISKS.MEDIUM),
  diag("/diag_decision_last", "decision.diag_last", "dispatchDecisionDiagnosticsCommands", RISKS.LOW),
  diag("/diag_decision_stats", "decision.diag_stats", "dispatchDecisionDiagnosticsCommands", RISKS.LOW),
  diag("/diag_decision_db_stats", "decision.diag_db_stats", "dispatchDecisionDiagnosticsCommands", RISKS.MEDIUM),
  diag("/diag_decision_last_db", "decision.diag_last_db", "dispatchDecisionDiagnosticsCommands", RISKS.MEDIUM),
  diag("/diag_decision_window", "decision.diag_window", "dispatchDecisionDiagnosticsCommands", RISKS.MEDIUM),
  diag("/diag_decision_promotion", "decision.diag_promotion", "dispatchDecisionDiagnosticsCommands", RISKS.MEDIUM),
]);

export default DIAGNOSTICS_LEGACY_COMMAND_INVENTORY;
