// AGENT NOTE:
// SG 2.0 agent capability constants skeleton.
// Purpose: describe agent capabilities as static metadata only.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

export const AGENT_CAPABILITIES = Object.freeze({
  repoIntelligenceReadOnly: "repo_intelligence_read_only",
  repoMaintenanceReportOnly: "repo_maintenance_report_only",
  renderFactCollectionReportBuilder: "render_fact_collection_report_builder",
  workspaceReadProvidedContent: "workspace_read_provided_content",
  workspaceWritePlanOnly: "workspace_write_plan_only",
});

export const AGENT_SAFETY_FLAGS = Object.freeze({
  canChangeState: false,
  tokensSpent: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  executesAgents: false,
});

export function buildSafeAgentCapability(capability) {
  return {
    capability,
    ...AGENT_SAFETY_FLAGS,
  };
}

export default {
  AGENT_CAPABILITIES,
  AGENT_SAFETY_FLAGS,
  buildSafeAgentCapability,
};
