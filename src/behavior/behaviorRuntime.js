// AGENT NOTE:
// SG 2.0 Behavior Layer runtime bridge.
// Purpose: create a small runtime behavior context for message handling without turning SG into a command router.
// This layer must stay meaning-first and must not classify user intent by brittle keyword rules.
// Do not add tool execution, transport logic, or canned user-facing responses here.

import { evaluateActionPolicy, getDefaultActionTypeForAnswer } from "./actionPolicy.js";

export function buildBehaviorRuntimeContext({ identity = {}, text = "" } = {}) {
  const actionType = getDefaultActionTypeForAnswer();
  const policyCheck = evaluateActionPolicy({
    actionType,
    identity,
    hasApproval: false,
    hasSource: false,
    hasPlan: false,
  });

  return {
    actionType,
    policyCheck,
    languageSource: "latest_user_message",
    livingSg: true,
    meaningFirst: true,
    rawTextLength: String(text || "").length,
  };
}

export function assertBehaviorRuntimeAllowed(behaviorRuntime = {}) {
  if (behaviorRuntime?.policyCheck?.ok) {
    return {
      ok: true,
      reason: "allowed",
    };
  }

  return {
    ok: false,
    reason: behaviorRuntime?.policyCheck?.reason || "behavior_policy_denied",
    missing: behaviorRuntime?.policyCheck?.missing || [],
  };
}
