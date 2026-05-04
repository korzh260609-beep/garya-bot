// AGENT NOTE:
// SG 2.0 AgentRegistryService skeleton.
// Purpose: expose static agent metadata safely.
// This service is not an executor, router, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, or filesystem here.

import { createAgentResult } from "../contracts/agentResult.js";
import { getRegisteredAgentById, listRegisteredAgents } from "./AgentRegistry.js";

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
        registryOnly: true,
        executesAgents: false,
        connectedToRuntime: false,
        connectedToTelegram: false,
        connectedToRender: false,
        connectedToGitHub: false,
        connectedToDatabase: false,
        connectedToAI: false,
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
        registryOnly: true,
        executesAgents: false,
        requestedAgentId: String(agentId || ""),
      },
    });
  }
}

export default AgentRegistryService;
