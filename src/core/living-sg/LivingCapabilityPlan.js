// src/core/living-sg/LivingCapabilityPlan.js
// ============================================================================
// LIVING SG — Capability Plan Skeleton
//
// Purpose:
// - translate Living SG intent into allowed capability categories;
// - keep capability planning read-only;
// - do not execute tools, commands, diagnostics or external actions.
// ============================================================================

import { LIVING_INTENT_KIND } from "./LivingIntentPlan.js";

export const LIVING_CAPABILITY = Object.freeze({
  THINK: "think",
  ANALYZE: "analyze",
  CLARIFY: "clarify",
  PREPARE_PROPOSAL: "prepare_proposal",
  PREPARE_CODE_PROPOSAL: "prepare_code_proposal",
  MEMORY_PROPOSAL: "memory_proposal",
  NONE: "none",
});

export const LIVING_ACTION_TYPE = Object.freeze({
  READ_ONLY: "read_only",
  NEEDS_CONFIRMATION: "needs_confirmation",
  BLOCKED: "blocked",
});

export function createLivingCapabilityPlan({ intentPlan = {} } = {}) {
  const intentKind = intentPlan?.intentKind;

  if (intentKind === LIVING_INTENT_KIND.CLARIFY) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingCapabilityPlan",
      capabilities: [LIVING_CAPABILITY.CLARIFY],
      actionType: LIVING_ACTION_TYPE.READ_ONLY,
      requiresConfirmation: false,
      reason: "clarification_is_read_only",
      intentPlan,
    };
  }

  if (intentKind === LIVING_INTENT_KIND.PROJECT_THINKING) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingCapabilityPlan",
      capabilities: [
        LIVING_CAPABILITY.THINK,
        LIVING_CAPABILITY.ANALYZE,
        LIVING_CAPABILITY.PREPARE_PROPOSAL,
      ],
      actionType: LIVING_ACTION_TYPE.READ_ONLY,
      requiresConfirmation: false,
      reason: "project_thinking_without_state_change",
      intentPlan,
    };
  }

  if (intentKind === LIVING_INTENT_KIND.MEMORY_THINKING) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingCapabilityPlan",
      capabilities: [
        LIVING_CAPABILITY.THINK,
        LIVING_CAPABILITY.MEMORY_PROPOSAL,
      ],
      actionType: LIVING_ACTION_TYPE.NEEDS_CONFIRMATION,
      requiresConfirmation: true,
      reason: "memory_changes_require_confirmation",
      intentPlan,
    };
  }

  if (intentKind === LIVING_INTENT_KIND.GENERAL_RESPONSE) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingCapabilityPlan",
      capabilities: [LIVING_CAPABILITY.THINK],
      actionType: LIVING_ACTION_TYPE.READ_ONLY,
      requiresConfirmation: false,
      reason: "general_living_response",
      intentPlan,
    };
  }

  return {
    ok: false,
    dryRun: true,
    source: "LivingCapabilityPlan",
    capabilities: [LIVING_CAPABILITY.NONE],
    actionType: LIVING_ACTION_TYPE.BLOCKED,
    requiresConfirmation: false,
    reason: "unknown_intent_kind",
    intentPlan,
  };
}

export default {
  LIVING_CAPABILITY,
  LIVING_ACTION_TYPE,
  createLivingCapabilityPlan,
};
