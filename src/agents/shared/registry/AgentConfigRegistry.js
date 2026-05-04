// AGENT NOTE:
// SG 2.0 static agent config registry skeleton.
// Purpose: describe safe per-agent config metadata and future interface hints only.
// This registry is not an executor, router, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

export const AGENT_CONFIG_SAFETY = Object.freeze({
  readOnly: true,
  canChangeState: false,
  tokensSpent: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  executesAgents: false,
  writesFilesystem: false,
  writesRepository: false,
});

export const AGENT_CONFIG_REGISTRY = Object.freeze([
  Object.freeze({
    agentId: "repo-state-agent",
    configMode: "provided_input_only",
    allowedActions: Object.freeze(["build_repo_state_summary"]),
    limits: Object.freeze({
      maxFiles: 200,
      maxDependencies: 200,
    }),
    futureInterface: Object.freeze({
      mayReadRepositoryLater: true,
      mayConnectToGitHubLater: true,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
  Object.freeze({
    agentId: "repo-maintenance-agent",
    configMode: "provided_changed_files_only",
    allowedActions: Object.freeze(["build_after_change_report"]),
    limits: Object.freeze({
      maxChangedFiles: 200,
    }),
    futureInterface: Object.freeze({
      mayReadRepositoryLater: true,
      mayConnectToGitHubLater: true,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
  Object.freeze({
    agentId: "render-logs-collector",
    configMode: "provided_render_facts_only",
    allowedActions: Object.freeze([
      "list_deploys",
      "get_deploy",
      "get_latest_logs",
      "get_deploy_logs",
      "get_status",
      "build_workspace_report_from_provided_facts",
    ]),
    limits: Object.freeze({
      defaultLogsLimit: 100,
      maxLogsLimit: 1000,
      defaultDeploysLimit: 20,
      maxDeploysLimit: 100,
    }),
    futureInterface: Object.freeze({
      mayConnectToRenderLater: true,
      mayAnalyzeLogsLater: false,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
  Object.freeze({
    agentId: "workspace-reader-agent",
    configMode: "provided_workspace_content_only",
    allowedActions: Object.freeze(["read_provided_workspace_file", "parse_provided_workspace_command"]),
    limits: Object.freeze({
      maxContentChars: 50000,
    }),
    futureInterface: Object.freeze({
      mayReadFilesystemLater: true,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
  Object.freeze({
    agentId: "workspace-writer-agent",
    configMode: "write_plan_only",
    allowedActions: Object.freeze(["build_workspace_write_plan"]),
    limits: Object.freeze({
      maxContentChars: 50000,
      allowedWorkspacePaths: Object.freeze([
        "agent_workspace/RENDER_LOGS_REPORT.md",
        "agent_workspace/RENDER_STATUS_REPORT.md",
        "agent_workspace/REPO_STATE_REPORT.md",
        "agent_workspace/NEXT_ACTION_PLAN.md",
      ]),
    }),
    futureInterface: Object.freeze({
      mayWriteFilesystemLater: true,
      mayWriteRepositoryLater: false,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
  Object.freeze({
    agentId: "agent-inventory-agent",
    configMode: "provided_agent_metadata_only",
    allowedActions: Object.freeze(["build_inventory_from_provided_metadata"]),
    limits: Object.freeze({
      maxAgents: 200,
    }),
    futureInterface: Object.freeze({
      mayReadRegistryLater: true,
      mayReadRepositoryLater: true,
      requiresSeparateApproval: true,
    }),
    ...AGENT_CONFIG_SAFETY,
  }),
]);

export function listAgentConfigs() {
  return AGENT_CONFIG_REGISTRY.map((config) => ({
    ...config,
    allowedActions: [...config.allowedActions],
    limits: { ...config.limits },
    futureInterface: { ...config.futureInterface },
  }));
}

export function getAgentConfigById(agentId) {
  return listAgentConfigs().find((config) => config.agentId === String(agentId || "")) || null;
}

export function hasAgentConfig(agentId) {
  return Boolean(getAgentConfigById(agentId));
}

export function isAgentActionAllowed(agentId, action) {
  const config = getAgentConfigById(agentId);
  if (!config) return false;
  return config.allowedActions.includes(String(action || ""));
}

export default {
  AGENT_CONFIG_SAFETY,
  AGENT_CONFIG_REGISTRY,
  listAgentConfigs,
  getAgentConfigById,
  hasAgentConfig,
  isAgentActionAllowed,
};
