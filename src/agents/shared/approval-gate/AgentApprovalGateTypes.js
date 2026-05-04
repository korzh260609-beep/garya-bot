// AGENT NOTE:
// SG 2.0 agent approval gate type skeleton.
// Purpose: describe safe approval decisions after action plans and before future execution.
// This file is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

export const AGENT_APPROVAL_GATE_STATUS = Object.freeze({
  approved: "approved",
  blocked: "blocked",
  pendingApproval: "pending_approval",
  unknown: "unknown",
});

export const AGENT_APPROVAL_GATE_DECISION = Object.freeze({
  allowPlanOnly: "allow_plan_only",
  requireMonarchApproval: "require_monarch_approval",
  blockExecution: "block_execution",
  blockUnknownPlan: "block_unknown_plan",
});

export const AGENT_APPROVAL_GATE_ROLES = Object.freeze({
  monarch: "monarch",
  system: "system",
  citizen: "citizen",
  guest: "guest",
  unknown: "unknown",
});

export const AGENT_APPROVAL_GATE_SAFETY = Object.freeze({
  approvalGateOnly: true,
  planOnly: true,
  decisionOnly: true,
  readOnly: true,
  executionAllowed: false,
  canAuthorizeExecution: false,
  requiresExplicitMonarchApproval: true,
  requiresFinalMozhno: true,
  canChangeState: false,
  tokensSpent: false,
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
});

export default {
  AGENT_APPROVAL_GATE_STATUS,
  AGENT_APPROVAL_GATE_DECISION,
  AGENT_APPROVAL_GATE_ROLES,
  AGENT_APPROVAL_GATE_SAFETY,
};
