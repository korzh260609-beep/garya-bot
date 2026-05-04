// AGENT NOTE:
// SG 2.0 AgentRegistryService skeleton.
// Purpose: expose static agent metadata and config metadata safely.
// This service is not an executor, router, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

import { createAgentResult } from "../contracts/agentResult.js";
import { getRegisteredAgentById, listRegisteredAgents } from "./AgentRegistry.js";
import { getAgentConfigById, listAgentConfigs } from "./AgentConfigRegistry.js";

const REGISTRY_SERVICE_SAFETY_METADATA = Object.freeze({
  registryOnly: true,
  executesAgents: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  writesFilesystem: false,
  writesRepository: false,
});

export class AgentRegistryService {
  constructor({ agentName = "agent-registry" } = {}) {
    this.agentName = agentName;
  }

  listAgents() {
    return createAgentResult({
      agent: this.agentName,
      capability: "agent_registry_metadata_only",
      data: {
        agents: listRegisteredAgents(),
      },
      warnings: [
        "AgentRegistryService exposes metadata only. It does not execute agents or connect to runtime.",
      ],
      metadata: {
        mode: "agent_registry_skeleton_v1",
        ...REGISTRY_SERVICE_SAFETY_METADATA,
      },
    });
  }

  getAgent(agentId) {
    return createAgentResult({
      agent: this.agentName,
      capability: "agent_registry_metadata_only",
      data: {
        agent: getRegisteredAgentById(agentId),
      },
      warnings: [
        "AgentRegistryService returns static metadata only. It does not instantiate or execute agents.",
      ],
      metadata: {
        mode: "agent_registry_skeleton_v1",
        requestedAgentId: String(agentId || ""),
        ...REGISTRY_SERVICE_SAFETY_METADATA,
      },
    });
  }

  listAgentConfigs() {
    return createAgentResult({
      agent: this.agentName,
      capability: "agent_config_registry_metadata_only",
      data: {
        configs: listAgentConfigs(),
      },
      warnings: [
        "AgentRegistryService exposes agent config metadata only. It does not execute agents or apply config to runtime.",
      ],
      metadata: {
        mode: "agent_config_registry_skeleton_v1",
        configRegistryOnly: true,
        ...REGISTRY_SERVICE_SAFETY_METADATA,
      },
    });
  }

  getAgentConfig(agentId) {
    return createAgentResult({
      agent: this.agentName,
      capability: "agent_config_registry_metadata_only",
      data: {
        config: getAgentConfigById(agentId),
      },
      warnings: [
        "AgentRegistryService returns static agent config metadata only. It does not instantiate, execute, or connect agents.",
      ],
      metadata: {
        mode: "agent_config_registry_skeleton_v1",
        configRegistryOnly: true,
        requestedAgentId: String(agentId || ""),
        ...REGISTRY_SERVICE_SAFETY_METADATA,
      },
    });
  }
}

export default AgentRegistryService;
