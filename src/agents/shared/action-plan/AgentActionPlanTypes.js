// AGENT NOTE:
// SG 2.0 agent action plan type skeleton.
// Purpose: describe safe plan types between intent decision and future execution.
// This file is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

export const AGENT_ACTION_PLAN_TYPES = Object.freeze({
  suggestOnly: "suggest_only",
  collectFactsPlan: "collect_facts_plan",
  buildReportPlan: "build_report_plan",
  inspectRepoPlan: "inspect_repo_plan",
  inspectWorkspacePlan: "inspect_workspace_plan",
  writePlanOnly: "write_plan_only",
  unknown: "unknown",
});

export const AGENT_ACTION_PLAN_STATUS = Object.freeze({
  planned: "planned",
  blocked: "blocked",
  unknown: "unknown",
});

export const AGENT_ACTION_PLAN_SAFETY = Object.freeze({
  planOnly: true,
  decisionOnly: true,
  readOnly: true,
  executionAllowed: false,
  requiresApproval: true,
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
  AGENT_ACTION_PLAN_TYPES,
  AGENT_ACTION_PLAN_STATUS,
  AGENT_ACTION_PLAN_SAFETY,
};
