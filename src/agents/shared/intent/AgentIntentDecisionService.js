// AGENT NOTE:
// SG 2.0 AgentIntentDecisionService skeleton.
// Purpose: expose safe decision-only intent analysis for live human messages.
// This service is not a keyword-router, executor, runtime bridge, command handler, or technical mode.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import { createAgentErrorResult, createAgentResult } from "../contracts/agentResult.js";
import { buildAgentIntentDecision } from "./AgentIntentDecision.js";

export class AgentIntentDecisionService {
  constructor({ agentName = "agent-intent-decision" } = {}) {
    this.agentName = agentName;
  }

  decide({ message = "", metadata = {} } = {}) {
    try {
      const decision = buildAgentIntentDecision({ message, metadata });

      return createAgentResult({
        agent: this.agentName,
        capability: "agent_intent_decision_only",
        data: {
          decision,
        },
        warnings: [
          "AgentIntentDecisionService suggests an agent/action only. It does not execute agents or connect to runtime.",
        ],
        metadata: {
          mode: "agent_intent_decision_service_skeleton_v1",
          decisionOnly: true,
          liveMessageSupported: true,
          connectedToRuntime: false,
          connectedToTelegram: false,
          connectedToRender: false,
          connectedToGitHub: false,
          connectedToDatabase: false,
          connectedToAI: false,
          connectedToNetwork: false,
          executesAgents: false,
          writesFilesystem: false,
          writesRepository: false,
          isKeywordRouter: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "agent_intent_decision_service_skeleton_v1",
        },
      });
    }
  }
}

export default AgentIntentDecisionService;
