// src/core/commandPolicy/commandInventory.js
// ============================================================================
// COMMAND INVENTORY SKELETON — READ-ONLY REGISTRY
// ============================================================================
// Purpose:
// - provide a single future inventory for slash commands;
// - classify old command surfaces as Technical Mode / shortcut / admin;
// - prepare migration away from scattered command maps;
// - document action type, risk and confirmation needs;
// - avoid runtime behavior changes at this step.
//
// IMPORTANT:
// - This file is NOT wired into runtime yet.
// - Do not import handlers here.
// - Do not execute anything here.
// - Slash commands are not Living SG intelligence.
// - Fixed commands remain Technical Mode / shortcuts until migrated through
//   meaning -> intent -> capability -> permission -> risk -> confirmation.
// ============================================================================

import { MEMORY_COMMAND_INVENTORY } from "./commandInventoryMemory.js";

export const COMMAND_MODES = Object.freeze({
  TECHNICAL: "technical_mode",
  USER_SHORTCUT: "user_shortcut",
  ADMIN: "admin_technical_mode",
});

export const COMMAND_ACTION_TYPES = Object.freeze({
  READ: "read",
  STATE_CHANGE: "state_change",
  EXTERNAL_ACTION: "external_action",
  COSTLY_AI: "costly_ai",
  DIAGNOSTIC: "diagnostic",
});

export const COMMAND_RISK_LEVELS = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
});

function commandEntry({
  command,
  mode,
  capability,
  actionType,
  riskLevel,
  monarchOnly = false,
  privateOnly = false,
  requiresConfirmation = false,
  dispatcher = null,
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

export const COMMAND_INVENTORY = Object.freeze([
  // --------------------------------------------------------------------------
  // User-visible shortcuts. These may remain shortcuts, but must not define
  // Living SG intelligence.
  // --------------------------------------------------------------------------
  commandEntry({
    command: "/profile",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "profile.read",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchProfileModeCommands",
    notes: "User profile shortcut; Living SG should answer naturally via profile capability later.",
  }),
  commandEntry({
    command: "/me",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "profile.read",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchProfileModeCommands",
  }),
  commandEntry({
    command: "/whoami",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "profile.read",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchProfileModeCommands",
  }),
  commandEntry({
    command: "/mode",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "answer_mode.set",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchProfileModeCommands",
    notes: "Answer style shortcut; natural style requests should route through meaning/capability later.",
  }),
  commandEntry({
    command: "/price",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "market.price.read",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchPriceCommands",
  }),
  commandEntry({
    command: "/prices",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "market.price.read_multi",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchPriceCommands",
  }),

  // --------------------------------------------------------------------------
  // Identity shortcuts.
  // --------------------------------------------------------------------------
  commandEntry({
    command: "/link_start",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "identity.link.start",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchIdentityCommands",
  }),
  commandEntry({
    command: "/link_confirm",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "identity.link.confirm",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchIdentityCommands",
  }),
  commandEntry({
    command: "/link_status",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "identity.link.status",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchIdentityCommands",
  }),

  // --------------------------------------------------------------------------
  // Task Engine technical shortcuts.
  // --------------------------------------------------------------------------
  commandEntry({
    command: "/tasks",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.list",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/newtask",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.create",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/new_task",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.create",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/run",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.run",
    actionType: COMMAND_ACTION_TYPES.COSTLY_AI,
    riskLevel: COMMAND_RISK_LEVELS.HIGH,
    dispatcher: "dispatchTaskCommands",
    requiresConfirmation: true,
    notes: "Manual task execution can trigger AI/cost/state changes; future natural flow must confirm when needed.",
  }),
  commandEntry({
    command: "/run_task",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.run",
    actionType: COMMAND_ACTION_TYPES.COSTLY_AI,
    riskLevel: COMMAND_RISK_LEVELS.HIGH,
    dispatcher: "dispatchTaskCommands",
    requiresConfirmation: true,
  }),
  commandEntry({
    command: "/stop_task",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.stop",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/start_task",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "task.start",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.HIGH,
    dispatcher: "dispatchTaskCommands",
    notes: "Currently routed by dispatchTaskCommands; must be aligned with CMD_ACTION/command policies before hardening.",
  }),
  commandEntry({
    command: "/stop_tasks_type",
    mode: COMMAND_MODES.ADMIN,
    capability: "task.stop_by_type",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.HIGH,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: true,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/stop_all_tasks",
    mode: COMMAND_MODES.ADMIN,
    capability: "task.stop_all",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.CRITICAL,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: true,
    dispatcher: "dispatchTaskCommands",
  }),
  commandEntry({
    command: "/stop_all",
    mode: COMMAND_MODES.ADMIN,
    capability: "task.stop_all",
    actionType: COMMAND_ACTION_TYPES.STATE_CHANGE,
    riskLevel: COMMAND_RISK_LEVELS.CRITICAL,
    monarchOnly: true,
    privateOnly: true,
    requiresConfirmation: true,
    dispatcher: "dispatchTaskCommands",
    notes: "Legacy alias for /stop_all_tasks.",
  }),

  // --------------------------------------------------------------------------
  // Project repo / workflow Technical Mode.
  // --------------------------------------------------------------------------
  ...[
    ["/reindex", "repo.reindex", COMMAND_ACTION_TYPES.STATE_CHANGE, COMMAND_RISK_LEVELS.HIGH, true],
    ["/repo_status", "repo.status", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_tree", "repo.tree", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_file", "repo.file.read", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_search", "repo.search", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_analyze", "repo.analyze", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_diff", "repo.diff", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_get", "repo.file.get", COMMAND_ACTION_TYPES.READ, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_check", "repo.check", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_review", "repo.review", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/repo_review2", "repo.review.legacy", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/workflow_check", "workflow.check", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/stage_check", "workflow.stage_check", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.MEDIUM, false],
    ["/code_output_status", "code_output.status", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.LOW, false],
    ["/project_intent_diag", "project_intent.diagnostic", COMMAND_ACTION_TYPES.DIAGNOSTIC, COMMAND_RISK_LEVELS.LOW, false],
  ].map(([command, capability, actionType, riskLevel, requiresConfirmation]) =>
    commandEntry({
      command,
      mode: COMMAND_MODES.ADMIN,
      capability,
      actionType,
      riskLevel,
      monarchOnly: true,
      privateOnly: true,
      requiresConfirmation,
      dispatcher: "dispatchProjectRepoCommands",
      notes: "Technical Mode only. Not Living SG. Repo facts should move toward RepoStateAgent-backed source-first flows.",
    })
  ),

  // --------------------------------------------------------------------------
  // Source shortcuts.
  // --------------------------------------------------------------------------
  commandEntry({
    command: "/sources",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "source.list",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchSourcesCommands",
  }),
  commandEntry({
    command: "/source",
    mode: COMMAND_MODES.USER_SHORTCUT,
    capability: "source.fetch",
    actionType: COMMAND_ACTION_TYPES.READ,
    riskLevel: COMMAND_RISK_LEVELS.MEDIUM,
    dispatcher: "dispatchSourcesCommands",
  }),
  commandEntry({
    command: "/diag_source",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "source.diagnose",
    actionType: COMMAND_ACTION_TYPES.DIAGNOSTIC,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchSourcesCommands",
  }),
  commandEntry({
    command: "/test_source",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "source.test",
    actionType: COMMAND_ACTION_TYPES.DIAGNOSTIC,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchSourcesCommands",
  }),
  commandEntry({
    command: "/sources_diag",
    mode: COMMAND_MODES.TECHNICAL,
    capability: "source.diagnostics",
    actionType: COMMAND_ACTION_TYPES.DIAGNOSTIC,
    riskLevel: COMMAND_RISK_LEVELS.LOW,
    dispatcher: "dispatchSourcesCommands",
  }),

  // --------------------------------------------------------------------------
  // Memory / Project Memory Technical Mode inventory entries.
  // Split into a separate data-only file to keep this registry readable.
  // --------------------------------------------------------------------------
  ...MEMORY_COMMAND_INVENTORY,
]);

export function getCommandInventoryEntry(command) {
  const normalized = String(command || "").trim().split("@")[0];
  return COMMAND_INVENTORY.find((entry) => entry.command === normalized) || null;
}

export function listCommandInventory({ mode = null, riskLevel = null } = {}) {
  return COMMAND_INVENTORY.filter((entry) => {
    if (mode && entry.mode !== mode) return false;
    if (riskLevel && entry.riskLevel !== riskLevel) return false;
    return true;
  });
}

export default COMMAND_INVENTORY;
