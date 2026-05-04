// AGENT NOTE:
// SG 2.0 AgentActionPlanService skeleton.
// Purpose: expose safe plan-only conversion from intent decision to action plan.
// This service is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import { createAgentErrorResult, createAgentResult } from "../contracts/agentResult.js";
import { buildAgentActionPlan } from "./AgentActionPlanBuilder.js";

export class AgentActionPlanService {
  constructor({ agentName = "agent-action-plan" } = {}) {
    this.agentName = agentName;
  }

  buildPlan({ decision = {}, metadata = {} } = {}) {
    try {
      const actionPlan = buildAgentActionPlan({ decision, metadata });

      return createAgentResult({
        agent: this.agentName,
        capability: "agent_action_plan_only",
        data: {
          actionPlan,
        },
        warnings: [
          "AgentActionPlanService builds plans only. It does not execute agents or connect to runtime.",
        ],
        metadata: {
          mode: "agent_action_plan_service_skeleton_v1",
          planOnly: true,
          decisionOnly: true,
          executionAllowed: false,
          requiresApproval: true,
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
          isTechnicalMode: false,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "agent_action_plan_service_skeleton_v1",
        },
      });
    }
  }
}

export default AgentActionPlanService;
