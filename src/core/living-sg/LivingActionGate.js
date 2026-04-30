// src/core/living-sg/LivingActionGate.js
// ============================================================================
// LIVING SG — Action Gate Skeleton
//
// Purpose:
// - block state-changing actions unless explicitly approved later;
// - keep the first skeleton read-only;
// - do not call legacy technical/projectIntent/diagnostic handlers.
// ============================================================================

import { LIVING_ACTION_TYPE } from "./LivingCapabilityPlan.js";

export const LIVING_GATE_STATUS = Object.freeze({
  ALLOW_READ_ONLY: "allow_read_only",
  NEEDS_CONFIRMATION: "needs_confirmation",
  BLOCKED: "blocked",
});

export function evaluateLivingActionGate({ capabilityPlan = {}, confirmation = null } = {}) {
  if (!capabilityPlan?.ok) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingActionGate",
      status: LIVING_GATE_STATUS.BLOCKED,
      canExecute: false,
      reason: capabilityPlan?.reason || "invalid_capability_plan",
      capabilityPlan,
    };
  }

  if (capabilityPlan.actionType === LIVING_ACTION_TYPE.READ_ONLY) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingActionGate",
      status: LIVING_GATE_STATUS.ALLOW_READ_ONLY,
      canExecute: true,
      canChangeState: false,
      reason: "read_only_living_action_allowed",
      capabilityPlan,
    };
  }

  if (capabilityPlan.actionType === LIVING_ACTION_TYPE.NEEDS_CONFIRMATION) {
    const confirmed = confirmation?.approved === true;

    return {
      ok: confirmed,
      dryRun: true,
      source: "LivingActionGate",
      status: confirmed ? LIVING_GATE_STATUS.ALLOW_READ_ONLY : LIVING_GATE_STATUS.NEEDS_CONFIRMATION,
      canExecute: confirmed,
      canChangeState: false,
      reason: confirmed
        ? "confirmation_present_but_skeleton_still_read_only"
        : "confirmation_required_before_state_change",
      capabilityPlan,
    };
  }

  return {
    ok: false,
    dryRun: true,
    source: "LivingActionGate",
    status: LIVING_GATE_STATUS.BLOCKED,
    canExecute: false,
    canChangeState: false,
    reason: "blocked_or_unknown_action_type",
    capabilityPlan,
  };
}

export default {
  LIVING_GATE_STATUS,
  evaluateLivingActionGate,
};
