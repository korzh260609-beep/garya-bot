// AGENT NOTE:
// AgentInventoryAgent service skeleton.
// Purpose: build an inventory from provided agent metadata only.
// Do not connect this service to Telegram, runtime, Render, GitHub, DB, AI, or filesystem.

import { createAgentErrorResult, createAgentResult } from "../../shared/contracts/agentResult.js";
import { buildAgentInventoryReport } from "./AgentInventoryReportBuilder.js";

export class AgentInventoryAgentService {
  constructor({ agentName = "agent-inventory-agent" } = {}) {
    this.agentName = agentName;
  }

  buildInventory(input = {}) {
    try {
      const inventory = buildAgentInventoryReport(input);

      return createAgentResult({
        agent: this.agentName,
        capability: "agent_inventory_from_provided_metadata",
        data: {
          inventory,
        },
        warnings: [
          "AgentInventoryAgent skeleton uses only provided agent metadata. It does not scan repository files by itself.",
        ],
        metadata: {
          mode: "agent_inventory_agent_skeleton_v1",
          connectedToRuntime: false,
          connectedToTelegram: false,
          connectedToRender: false,
          connectedToGitHub: false,
          connectedToDatabase: false,
          connectedToAI: false,
          readsRepository: false,
          writesRepository: false,
          storesMemory: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "agent_inventory_agent_skeleton_v1",
        },
      });
    }
  }
}

export default AgentInventoryAgentService;
