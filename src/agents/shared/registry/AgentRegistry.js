// AGENT NOTE:
// SG 2.0 static agent registry skeleton.
// Purpose: list known agents and their safe metadata only.
// This registry is not an executor, router, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

import { AGENT_CAPABILITIES, buildSafeAgentCapability } from "./AgentCapabilities.js";

export const AGENT_REGISTRY = Object.freeze([
  Object.freeze({
    id: "repo-state-agent",
    name: "RepoStateAgent",
    layer: "repo-intelligence",
    modulePath: "src/agents/repo-intelligence/repo-state-agent",
    description: "Builds deterministic repo-state summaries from provided input only.",
    ...buildSafeAgentCapability(AGENT_CAPABILITIES.repoIntelligenceReadOnly),
  }),
  Object.freeze({
    id: "repo-maintenance-agent",
    name: "RepoMaintenanceAgent",
    layer: "repo-maintenance",
    modulePath: "src/agents/repo-maintenance/repo-maintenance-agent",
    description: "Builds deterministic after-change maintenance reports from provided changed-file input only.",
    ...buildSafeAgentCapability(AGENT_CAPABILITIES.repoMaintenanceReportOnly),
  }),
  Object.freeze({
    id: "render-logs-collector",
    name: "RenderLogsCollector",
    layer: "runtime-collector",
    modulePath: "src/agents/runtime-collector/render-logs-collector",
    description: "Formats already-collected Render facts into workspace-ready factual markdown reports.",
    ...buildSafeAgentCapability(AGENT_CAPABILITIES.renderFactCollectionReportBuilder),
  }),
  Object.freeze({
    id: "workspace-reader",
    name: "WorkspaceReader",
    layer: "shared-workspace",
    modulePath: "src/agents/shared/workspace/WorkspaceReader.js",
    description: "Normalizes provided workspace content and parses provided COMMANDS.md text only.",
    ...buildSafeAgentCapability(AGENT_CAPABILITIES.workspaceReadProvidedContent),
  }),
  Object.freeze({
    id: "workspace-writer",
    name: "WorkspaceWriter",
    layer: "shared-workspace",
    modulePath: "src/agents/shared/workspace/WorkspaceWriter.js",
    description: "Builds allowlisted workspace write-plans only and does not write files.",
    ...buildSafeAgentCapability(AGENT_CAPABILITIES.workspaceWritePlanOnly),
  }),
]);

export function listRegisteredAgents() {
  return AGENT_REGISTRY.map((agent) => ({ ...agent }));
}

export function getRegisteredAgentById(agentId) {
  return listRegisteredAgents().find((agent) => agent.id === String(agentId || "")) || null;
}

export function hasRegisteredAgent(agentId) {
  return Boolean(getRegisteredAgentById(agentId));
}

export default {
  AGENT_REGISTRY,
  listRegisteredAgents,
  getRegisteredAgentById,
  hasRegisteredAgent,
};
