// AGENT NOTE:
// SG 2.0 Behavior Layer action policy evaluator.
// Purpose: provide one code-level policy check for semantic SG action types.
// This is not a command router and must not replace Living SG reasoning.
// Do not add tool execution, transport handling, or canned user-facing responses here.

import { getActionPolicy, SG_ACTION_TYPES } from "./actionTypes.js";

export function evaluateActionPolicy({ actionType, identity = {}, hasApproval = false, hasSource = false, hasPlan = false } = {}) {
  const policy = getActionPolicy(actionType);

  if (!policy) {
    return {
      ok: false,
      actionType: actionType || null,
      reason: "unknown_action_type",
      message: "Unknown SG action type.",
      policy: null,
    };
  }

  const missing = [];

  if (policy.requiresMonarch && !identity.isMonarch) {
    missing.push("monarch_identity");
  }

  if (policy.requiresSource && !hasSource) {
    missing.push("verified_source");
  }

  if (policy.requiresPlanFirst && !hasPlan) {
    missing.push("plan_first");
  }

  if (policy.requiresApproval && !hasApproval) {
    missing.push("explicit_approval");
  }

  const requirementsMet = missing.length === 0;
  const allowed = requirementsMet && (policy.defaultAllowed || policy.requiresApproval);

  return {
    ok: allowed,
    actionType: policy.actionType,
    category: policy.category,
    stateChanging: policy.stateChanging,
    requiresSource: policy.requiresSource,
    requiresMonarch: policy.requiresMonarch,
    requiresApproval: policy.requiresApproval,
    requiresPlanFirst: policy.requiresPlanFirst,
    missing,
    reason: missing.length ? "policy_requirements_missing" : "allowed",
    policy,
  };
}

export function isStateChangingAction(actionType) {
  const policy = getActionPolicy(actionType);
  return Boolean(policy?.stateChanging);
}

export function requiresApproval(actionType) {
  const policy = getActionPolicy(actionType);
  return Boolean(policy?.requiresApproval);
}

export function getDefaultActionTypeForAnswer() {
  return SG_ACTION_TYPES.ANSWER;
}
