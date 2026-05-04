// AGENT NOTE:
// Public export boundary for SG 2.0 agent approval gate skeleton.
// Do not add runtime side effects here.

export {
  AGENT_APPROVAL_GATE_STATUS,
  AGENT_APPROVAL_GATE_DECISION,
  AGENT_APPROVAL_GATE_ROLES,
  AGENT_APPROVAL_GATE_SAFETY,
} from "./AgentApprovalGateTypes.js";
export { buildAgentApprovalDecision } from "./AgentApprovalGateBuilder.js";
export { AgentApprovalGateService } from "./AgentApprovalGateService.js";
