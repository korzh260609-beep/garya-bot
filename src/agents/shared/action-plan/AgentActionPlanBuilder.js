// AGENT NOTE:
// SG 2.0 agent action plan builder skeleton.
// Purpose: convert a safe intent decision into a non-executing action plan.
// This file is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import { getAgentConfigById, isAgentActionAllowed } from "../registry/AgentConfigRegistry.js";
import { getRegisteredAgentById } from "../registry/AgentRegistry.js";
import { AGENT_INTENT_TYPES } from "../intent/AgentIntentTypes.js";
import {
  AGENT_ACTION_PLAN_SAFETY,
  AGENT_ACTION_PLAN_STATUS,
  AGENT_ACTION_PLAN_TYPES,
} from "./AgentActionPlanTypes.js";

function toSafeString(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function planTypeForIntent(intentType) {
  switch (intentType) {
    case AGENT_INTENT_TYPES.agentInventory:
      return AGENT_ACTION_PLAN_TYPES.buildReportPlan;
    case AGENT_INTENT_TYPES.repoState:
    case AGENT_INTENT_TYPES.projectNextStep:
      return AGENT_ACTION_PLAN_TYPES.inspectRepoPlan;
    case AGENT_INTENT_TYPES.repoMaintenance:
      return AGENT_ACTION_PLAN_TYPES.buildReportPlan;
    case AGENT_INTENT_TYPES.renderStatus:
    case AGENT_INTENT_TYPES.renderLogs:
      return AGENT_ACTION_PLAN_TYPES.collectFactsPlan;
    case AGENT_INTENT_TYPES.workspaceRead:
      return AGENT_ACTION_PLAN_TYPES.inspectWorkspacePlan;
    case AGENT_INTENT_TYPES.workspaceWritePlan:
      return AGENT_ACTION_PLAN_TYPES.writePlanOnly;
    default:
      return AGENT_ACTION_PLAN_TYPES.unknown;
  }
}

function buildPlanSteps({ intentType, suggestedAgentId, suggestedAction }) {
  const steps = [
    Object.freeze({
      order: 1,
      type: "validate_intent_decision",
      description: "Validate that the live-message intent decision is safe and non-executing.",
      execute: false,
    }),
  ];

  if (suggestedAgentId && suggestedAction) {
    steps.push(
      Object.freeze({
        order: 2,
        type: "check_agent_registry",
        description: `Check registered metadata for ${suggestedAgentId}.`,
        agentId: suggestedAgentId,
        execute: false,
      }),
      Object.freeze({
        order: 3,
        type: "check_agent_config",
        description: `Check config allowlist for ${suggestedAgentId}:${suggestedAction}.`,
        agentId: suggestedAgentId,
        action: suggestedAction,
        execute: false,
      }),
      Object.freeze({
        order: 4,
        type: "suggest_next_safe_action",
        description: "Return a human-readable recommendation. Do not execute the agent yet.",
        intentType,
        agentId: suggestedAgentId,
        action: suggestedAction,
        execute: false,
      }),
    );
  } else {
    steps.push(
      Object.freeze({
        order: 2,
        type: "ask_for_clarification_or_safe_summary",
        description: "No safe agent/action suggestion is available in the skeleton.",
        execute: false,
      }),
    );
  }

  return Object.freeze(steps);
}

export function buildAgentActionPlan({ decision = {}, metadata = {} } = {}) {
  const intentType = toSafeString(decision.intentType, AGENT_INTENT_TYPES.unknown);
  const suggestedAgentId = decision.suggestedAgentId || null;
  const suggestedAction = decision.suggestedAction || null;
  const planType = planTypeForIntent(intentType);
  const registeredAgent = suggestedAgentId ? getRegisteredAgentById(suggestedAgentId) : null;
  const agentConfig = suggestedAgentId ? getAgentConfigById(suggestedAgentId) : null;
  const actionAllowedByConfig = suggestedAgentId && suggestedAction ? isAgentActionAllowed(suggestedAgentId, suggestedAction) : false;
  const canPlan = Boolean(registeredAgent && agentConfig && actionAllowedByConfig);

  return Object.freeze({
    status: canPlan ? AGENT_ACTION_PLAN_STATUS.planned : AGENT_ACTION_PLAN_STATUS.blocked,
    planType,
    intentType,
    suggestedAgentId,
    suggestedAction,
    registeredAgentFound: Boolean(registeredAgent),
    agentConfigFound: Boolean(agentConfig),
    actionAllowedByConfig: Boolean(actionAllowedByConfig),
    executionAllowed: false,
    requiresApproval: true,
    canChangeState: false,
    tokensSpent: false,
    steps: buildPlanSteps({ intentType, suggestedAgentId, suggestedAction }),
    safety: Object.freeze({
      ...AGENT_ACTION_PLAN_SAFETY,
    }),
    metadata: Object.freeze({
      ...metadata,
      mode: "agent_action_plan_skeleton_v1",
      planOnly: true,
      decisionOnly: true,
      notExecutor: true,
    }),
    warnings: Object.freeze([
      "AgentActionPlan is a plan-only skeleton. It does not execute agents or call APIs.",
      "Any future execution layer requires separate approval and must remain behind permissions and safety gates.",
    ]),
  });
}

export default {
  buildAgentActionPlan,
};
