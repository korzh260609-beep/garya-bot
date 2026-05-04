// AGENT NOTE:
// SG 2.0 agent approval gate builder skeleton.
// Purpose: convert a non-executing action plan into a non-executing approval decision.
// This file is not an executor, runtime bridge, command handler, technical mode, or keyword-router.
// Do not execute agents, call runtime, Telegram, Render, GitHub, DB, AI, filesystem, network, or external services here.

import {
  AGENT_APPROVAL_GATE_DECISION,
  AGENT_APPROVAL_GATE_ROLES,
  AGENT_APPROVAL_GATE_SAFETY,
  AGENT_APPROVAL_GATE_STATUS,
} from "./AgentApprovalGateTypes.js";

function toSafeString(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function normalizeRole(role) {
  const normalized = toSafeString(role, AGENT_APPROVAL_GATE_ROLES.unknown).toLowerCase();
  return Object.values(AGENT_APPROVAL_GATE_ROLES).includes(normalized)
    ? normalized
    : AGENT_APPROVAL_GATE_ROLES.unknown;
}

function hasApprovalCommand(value) {
  return toSafeString(value).length > 0;
}

function hasFinalMozhno(value) {
  return toSafeString(value).toUpperCase() === "МОЖНО";
}

function buildApprovalReasons({ actionPlan, requesterRole, approvalCommand }) {
  const reasons = [];

  if (!actionPlan || typeof actionPlan !== "object") {
    reasons.push("No valid action plan was provided.");
    return Object.freeze(reasons);
  }

  if (actionPlan.executionAllowed !== false) {
    reasons.push("Action plan must keep executionAllowed=false at this skeleton stage.");
  }

  if (actionPlan.requiresApproval !== true) {
    reasons.push("Action plan must require approval before any future execution layer.");
  }

  if (requesterRole !== AGENT_APPROVAL_GATE_ROLES.monarch) {
    reasons.push("Only monarch role may provide final approval in the skeleton.");
  }

  if (hasApprovalCommand(approvalCommand) && !hasFinalMozhno(approvalCommand)) {
    reasons.push("Final approval command must be exactly МОЖНО.");
  }

  return Object.freeze(reasons);
}

export function buildAgentApprovalDecision({ actionPlan = null, requester = {}, approvalCommand = "", metadata = {} } = {}) {
  const requesterRole = normalizeRole(requester?.role);
  const planStatus = toSafeString(actionPlan?.status, "unknown");
  const planType = toSafeString(actionPlan?.planType, "unknown");
  const suggestedAgentId = actionPlan?.suggestedAgentId || null;
  const suggestedAction = actionPlan?.suggestedAction || null;
  const approvalCommandProvided = hasApprovalCommand(approvalCommand);
  const approvalGiven = hasFinalMozhno(approvalCommand);
  const validPlan = Boolean(actionPlan && typeof actionPlan === "object" && planStatus === "planned");
  const monarchRequester = requesterRole === AGENT_APPROVAL_GATE_ROLES.monarch;
  const monarchApproved = monarchRequester && approvalGiven;
  const blockingReasons = buildApprovalReasons({ actionPlan, requesterRole, approvalCommand });
  const canApprovePlanOnly = Boolean(validPlan && monarchApproved && blockingReasons.length === 0);
  const waitsForMonarchApproval = Boolean(validPlan && monarchRequester && !approvalCommandProvided && blockingReasons.length === 0);

  let status = AGENT_APPROVAL_GATE_STATUS.pendingApproval;
  let decision = AGENT_APPROVAL_GATE_DECISION.requireMonarchApproval;

  if (!validPlan) {
    status = AGENT_APPROVAL_GATE_STATUS.blocked;
    decision = AGENT_APPROVAL_GATE_DECISION.blockUnknownPlan;
  } else if (canApprovePlanOnly) {
    status = AGENT_APPROVAL_GATE_STATUS.approved;
    decision = AGENT_APPROVAL_GATE_DECISION.allowPlanOnly;
  } else if (waitsForMonarchApproval) {
    status = AGENT_APPROVAL_GATE_STATUS.pendingApproval;
    decision = AGENT_APPROVAL_GATE_DECISION.requireMonarchApproval;
  } else if (blockingReasons.length > 0) {
    status = AGENT_APPROVAL_GATE_STATUS.blocked;
    decision = AGENT_APPROVAL_GATE_DECISION.blockExecution;
  }

  return Object.freeze({
    status,
    decision,
    planStatus,
    planType,
    suggestedAgentId,
    suggestedAction,
    requesterRole,
    approvalCommandProvided,
    approvalGiven,
    approvedBy: canApprovePlanOnly ? requesterRole : null,
    executionAllowed: false,
    canAuthorizeExecution: false,
    canChangeState: false,
    tokensSpent: false,
    safety: Object.freeze({
      ...AGENT_APPROVAL_GATE_SAFETY,
    }),
    blockingReasons,
    warnings: Object.freeze([
      "AgentApprovalGate is a decision-only skeleton. It does not execute plans or authorize runtime execution.",
      "Approval currently means plan approval only. Future execution requires a separate execution layer and permissions design.",
    ]),
    metadata: Object.freeze({
      ...metadata,
      ...AGENT_APPROVAL_GATE_SAFETY,
      mode: "agent_approval_gate_skeleton_v1",
      notExecutor: true,
    }),
  });
}

export default {
  buildAgentApprovalDecision,
};
