// src/core/commandPolicy/commandInventoryMemory.js
// ============================================================================
// MEMORY / PROJECT MEMORY COMMAND INVENTORY ENTRIES
// ============================================================================
// Purpose:
// - classify memory and project-memory slash commands as Technical Mode;
// - prepare migration toward controlled memory capabilities;
// - keep runtime behavior unchanged.
//
// IMPORTANT:
// - This file is data-only.
// - Do not import handlers here.
// - Do not execute anything here.
// - These commands are not Living SG intelligence.
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

function memoryDiagnostic(command, capability, riskLevel = RISKS.LOW, extra = {}) {
  return entry({
    command,
    mode: MODES.TECHNICAL,
    capability,
    actionType: ACTION_TYPES.DIAGNOSTIC,
    riskLevel,
    dispatcher: "dispatchMemoryDiagnosticsCommands",
    notes: "Memory diagnostic slash command. Technical Mode only; not Living SG.",
    ...extra,
  });
}

function projectMemoryRead(command, capability, dispatcher = "dispatchProjectMemoryBasicCommands") {
  return entry({
    command,
    mode: MODES.TECHNICAL,
    capability,
    actionType: ACTION_TYPES.READ,
    riskLevel: RISKS.MEDIUM,
    dispatcher,
    notes: "Project Memory read shortcut. Must migrate to controlled memory capability for Living SG.",
  });
}

function projectMemoryWrite(command, capability, dispatcher = "dispatchProjectMemoryBasicCommands", extra = {}) {
  return entry({
    command,
    mode: MODES.ADMIN,
    capability,
    actionType: ACTION_TYPES.STATE_CHANGE,
    riskLevel: RISKS.HIGH,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: true,
    dispatcher,
    notes: "Project Memory write/update command. Technical Mode only; requires strict gate before future runtime hardening.",
    ...extra,
  });
}

export const MEMORY_COMMAND_INVENTORY = Object.freeze([
  // --------------------------------------------------------------------------
  // Memory diagnostics / maintenance.
  // --------------------------------------------------------------------------
  memoryDiagnostic("/memory_monarch_diag", "memory.monarch_diag", RISKS.MEDIUM, {
    monarchOnly: true,
    notes: "Monarch memory diagnostic. Technical Mode only.",
  }),
  memoryDiagnostic("/memory_status", "memory.status"),
  memoryDiagnostic("/memory_diag", "memory.diag"),
  memoryDiagnostic("/memory_integrity", "memory.integrity", RISKS.MEDIUM, {
    monarchOnly: true,
  }),
  memoryDiagnostic("/memory_backfill", "memory.backfill", RISKS.HIGH, {
    actionType: ACTION_TYPES.STATE_CHANGE,
    monarchOnly: true,
    requiresConfirmation: true,
    notes: "Memory backfill can change stored memory state. Technical Mode only.",
  }),
  memoryDiagnostic("/memory_user_chats", "memory.user_chats", RISKS.MEDIUM),
  memoryDiagnostic("/memory_longterm_diag", "memory.longterm_diag", RISKS.MEDIUM),
  memoryDiagnostic("/memory_type_stats", "memory.type_stats"),
  memoryDiagnostic("/memory_fetch_type", "memory.fetch_type", RISKS.MEDIUM),
  memoryDiagnostic("/memory_fetch_key", "memory.fetch_key", RISKS.MEDIUM),
  memoryDiagnostic("/memory_summary_service", "memory.summary_service", RISKS.MEDIUM),
  memoryDiagnostic("/memory_select_context", "memory.select_context", RISKS.MEDIUM),
  memoryDiagnostic("/memory_format_context", "memory.format_context", RISKS.MEDIUM),
  memoryDiagnostic("/memory_prompt_bridge", "memory.prompt_bridge", RISKS.MEDIUM),
  memoryDiagnostic("/memory_reclassify_explicit", "memory.reclassify_explicit", RISKS.HIGH, {
    actionType: ACTION_TYPES.STATE_CHANGE,
    monarchOnly: true,
    requiresConfirmation: true,
    notes: "Can reclassify explicit memory entries. Technical Mode only.",
  }),

  // --------------------------------------------------------------------------
  // Project Memory basic operations.
  // --------------------------------------------------------------------------
  memoryDiagnostic("/pm_wiring_diag", "project_memory.wiring_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_show_diag", "project_memory.show_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_context_diag", "project_memory.context_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_shadow_context_diag", "project_memory.shadow_context_diag", RISKS.MEDIUM, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_shadow_restore_controlled_diag", "project_memory.shadow_restore_controlled_diag", RISKS.HIGH, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
    actionType: ACTION_TYPES.STATE_CHANGE,
    monarchOnly: true,
    requiresConfirmation: true,
  }),
  memoryDiagnostic("/pm_surface_diag", "project_memory.surface_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_find_diag", "project_memory.find_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  memoryDiagnostic("/pm_controlled_diag", "project_memory.controlled_diag", RISKS.HIGH, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
    actionType: ACTION_TYPES.STATE_CHANGE,
    monarchOnly: true,
    requiresConfirmation: true,
  }),
  projectMemoryRead("/pm_capabilities", "project_memory.capabilities"),
  memoryDiagnostic("/pm_capabilities_diag", "project_memory.capabilities_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryBasicCommands",
  }),
  projectMemoryRead("/pm_show", "project_memory.show"),
  projectMemoryWrite("/pm_set", "project_memory.set"),
  projectMemoryRead("/pm_list", "project_memory.list"),
  projectMemoryRead("/pm_latest", "project_memory.latest"),
  projectMemoryRead("/pm_digest", "project_memory.digest"),
  projectMemoryRead("/pm_find", "project_memory.find"),

  // --------------------------------------------------------------------------
  // Project Memory sessions.
  // --------------------------------------------------------------------------
  projectMemoryWrite("/pm_session", "project_memory.session.create", "dispatchProjectMemorySessionCommands"),
  projectMemoryWrite("/pm_session_update", "project_memory.session.update", "dispatchProjectMemorySessionCommands"),
  memoryDiagnostic("/pm_session_controlled_diag", "project_memory.session.controlled_diag", RISKS.HIGH, {
    dispatcher: "dispatchProjectMemorySessionCommands",
    actionType: ACTION_TYPES.STATE_CHANGE,
    monarchOnly: true,
    requiresConfirmation: true,
  }),
  memoryDiagnostic("/pm_sessions_diag", "project_memory.sessions_diag", RISKS.LOW, {
    dispatcher: "dispatchProjectMemorySessionCommands",
  }),
  projectMemoryRead("/pm_sessions", "project_memory.sessions", "dispatchProjectMemorySessionCommands"),
  projectMemoryRead("/pm_session_show", "project_memory.session_show", "dispatchProjectMemorySessionCommands"),

  // --------------------------------------------------------------------------
  // Confirmed Project Memory.
  // --------------------------------------------------------------------------
  projectMemoryWrite("/pm_confirmed_write", "project_memory.confirmed.write", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryWrite("/pm_confirmed_update", "project_memory.confirmed.update", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryWrite("/pm_update", "project_memory.confirmed.update", "dispatchProjectMemoryConfirmedCommands", {
    notes: "Alias for confirmed project memory update. Technical Mode only.",
  }),
  projectMemoryRead("/pm_confirmed_list", "project_memory.confirmed.list", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryRead("/pm_confirmed_latest", "project_memory.confirmed.latest", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryRead("/pm_last", "project_memory.confirmed.latest", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryRead("/pm_confirmed_digest", "project_memory.confirmed.digest", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryRead("/pm_confirmed_context", "project_memory.confirmed.context", "dispatchProjectMemoryConfirmedCommands"),
  projectMemoryRead("/pm_context", "project_memory.confirmed.context", "dispatchProjectMemoryConfirmedCommands"),
  memoryDiagnostic("/pm_confirmed_scope_debug", "project_memory.confirmed.scope_debug", RISKS.LOW, {
    dispatcher: "dispatchProjectMemoryConfirmedCommands",
  }),
]);

export default MEMORY_COMMAND_INVENTORY;
