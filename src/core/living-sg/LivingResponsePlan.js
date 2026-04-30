// src/core/living-sg/LivingResponsePlan.js
// ============================================================================
// LIVING SG — Response Plan Skeleton
//
// Purpose:
// - prepare a response plan for the future Living SG path;
// - do not generate final AI text here;
// - do not execute tools, commands, diagnostics or writes.
// ============================================================================

import { LIVING_GATE_STATUS } from "./LivingActionGate.js";

export const LIVING_RESPONSE_KIND = Object.freeze({
  ANSWER: "answer",
  CLARIFICATION: "clarification",
  CONFIRMATION_REQUEST: "confirmation_request",
  BLOCKED: "blocked",
});

export function createLivingResponsePlan({ request = {}, intentPlan = {}, capabilityPlan = {}, gate = {} } = {}) {
  if (gate?.status === LIVING_GATE_STATUS.NEEDS_CONFIRMATION) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingResponsePlan",
      responseKind: LIVING_RESPONSE_KIND.CONFIRMATION_REQUEST,
      shouldCallAI: false,
      shouldExecuteTool: false,
      text: "Для этого действия нужно подтверждение. В текущем skeleton state-changing действия не выполняются.",
      request,
      intentPlan,
      capabilityPlan,
      gate,
    };
  }

  if (gate?.status === LIVING_GATE_STATUS.BLOCKED || gate?.ok === false) {
    return {
      ok: false,
      dryRun: true,
      source: "LivingResponsePlan",
      responseKind: LIVING_RESPONSE_KIND.BLOCKED,
      shouldCallAI: false,
      shouldExecuteTool: false,
      text: "Действие заблокировано Living SG gate.",
      request,
      intentPlan,
      capabilityPlan,
      gate,
    };
  }

  if (intentPlan?.intentKind === "clarify") {
    return {
      ok: true,
      dryRun: true,
      source: "LivingResponsePlan",
      responseKind: LIVING_RESPONSE_KIND.CLARIFICATION,
      shouldCallAI: true,
      shouldExecuteTool: false,
      text: null,
      request,
      intentPlan,
      capabilityPlan,
      gate,
    };
  }

  return {
    ok: true,
    dryRun: true,
    source: "LivingResponsePlan",
    responseKind: LIVING_RESPONSE_KIND.ANSWER,
    shouldCallAI: true,
    shouldExecuteTool: false,
    text: null,
    request,
    intentPlan,
    capabilityPlan,
    gate,
  };
}

export default {
  LIVING_RESPONSE_KIND,
  createLivingResponsePlan,
};
