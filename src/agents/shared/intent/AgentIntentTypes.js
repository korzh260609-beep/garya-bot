// AGENT NOTE:
// SG 2.0 agent intent type skeleton.
// Purpose: describe safe intent categories for live human messages.
// This file is not a keyword-router, executor, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

export const AGENT_INTENT_TYPES = Object.freeze({
  agentInventory: "agent_inventory",
  repoState: "repo_state",
  repoMaintenance: "repo_maintenance",
  renderStatus: "render_status",
  renderLogs: "render_logs",
  workspaceRead: "workspace_read",
  workspaceWritePlan: "workspace_write_plan",
  projectNextStep: "project_next_step",
  unknown: "unknown",
});

export const AGENT_INTENT_SAFETY = Object.freeze({
  decisionOnly: true,
  readOnly: true,
  canChangeState: false,
  tokensSpent: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  connectedToNetwork: false,
  executesAgents: false,
  executesRequests: false,
  writesFilesystem: false,
  writesRepository: false,
  isKeywordRouter: false,
});

export const AGENT_INTENT_TO_AGENT = Object.freeze({
  [AGENT_INTENT_TYPES.agentInventory]: "agent-inventory-agent",
  [AGENT_INTENT_TYPES.repoState]: "repo-state-agent",
  [AGENT_INTENT_TYPES.repoMaintenance]: "repo-maintenance-agent",
  [AGENT_INTENT_TYPES.renderStatus]: "render-logs-collector",
  [AGENT_INTENT_TYPES.renderLogs]: "render-logs-collector",
  [AGENT_INTENT_TYPES.workspaceRead]: "workspace-reader-agent",
  [AGENT_INTENT_TYPES.workspaceWritePlan]: "workspace-writer-agent",
  [AGENT_INTENT_TYPES.projectNextStep]: "repo-state-agent",
  [AGENT_INTENT_TYPES.unknown]: null,
});

export const AGENT_INTENT_TO_ACTION = Object.freeze({
  [AGENT_INTENT_TYPES.agentInventory]: "build_inventory_from_provided_metadata",
  [AGENT_INTENT_TYPES.repoState]: "build_repo_state_summary",
  [AGENT_INTENT_TYPES.repoMaintenance]: "build_after_change_report",
  [AGENT_INTENT_TYPES.renderStatus]: "get_status",
  [AGENT_INTENT_TYPES.renderLogs]: "get_latest_logs",
  [AGENT_INTENT_TYPES.workspaceRead]: "read_provided_workspace_file",
  [AGENT_INTENT_TYPES.workspaceWritePlan]: "build_workspace_write_plan",
  [AGENT_INTENT_TYPES.projectNextStep]: "build_repo_state_summary",
  [AGENT_INTENT_TYPES.unknown]: null,
});

export default {
  AGENT_INTENT_TYPES,
  AGENT_INTENT_SAFETY,
  AGENT_INTENT_TO_AGENT,
  AGENT_INTENT_TO_ACTION,
};
