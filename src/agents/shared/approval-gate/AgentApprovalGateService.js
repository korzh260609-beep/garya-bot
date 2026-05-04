// AGENT NOTE:
// SG 2.0 AgentApprovalGateService skeleton.
// Purpose: expose safe decision-only approval checks after action plans and before future execution.
// This service is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import { createAgentErrorResult, createAgentResult } from "../contracts/agentResult.js";
import { buildAgentApprovalDecision } from "./AgentApprovalGateBuilder.js";
import { AGENT_APPROVAL_GATE_SAFETY } from "./AgentApprovalGateTypes.js";

export class AgentApprovalGateService {
  constructor({ agentName = "agent-approval-gate" } = {}) {
    this.agentName = agentName;
  }

  reviewPlan({ actionPlan = null, requester = {}, approvalCommand = "", metadata = {} } = {}) {
    try {
      const approvalDecision = buildAgentApprovalDecision({
        actionPlan,
        requester,
        approvalCommand,
        metadata,
      });

      return createAgentResult({
        agent: this.agentName,
        capability: "agent_approval_gate_decision_only",
        data: {
          approvalDecision,
        },
        warnings: [
          "AgentApprovalGateService reviews plans only. It does not execute agents or authorize runtime execution.",
        ],
        metadata: {
          ...AGENT_APPROVAL_GATE_SAFETY,
          mode: "agent_approval_gate_service_skeleton_v1",
          notExecutor: true,
        },
      });
    } catch (error) {
      return createAgentErrorResult({
        agent: this.agentName,
        error: error?.message || String(error),
        metadata: {
          mode: "agent_approval_gate_service_skeleton_v1",
        },
      });
    }
  }
}

export default AgentApprovalGateService;
