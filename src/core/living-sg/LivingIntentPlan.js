// src/core/living-sg/LivingIntentPlan.js
// ============================================================================
// LIVING SG — Intent Plan Skeleton
//
// Purpose:
// - represent user meaning as a high-level Living SG intent;
// - avoid slash-command semantics;
// - avoid diagnostic bridge semantics;
// - keep execution separate from planning.
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

export const LIVING_INTENT_KIND = Object.freeze({
  GENERAL_RESPONSE: "general_response",
  PROJECT_THINKING: "project_thinking",
  MEMORY_THINKING: "memory_thinking",
  CLARIFY: "clarify",
  UNKNOWN: "unknown",
});

export function createLivingIntentPlan({ request = {}, meaning = {} } = {}) {
  const domain = safeText(meaning?.domain);
  const suggestedAction = safeText(meaning?.suggestedAction);
  const intent = safeText(meaning?.intent);

  if (suggestedAction === "clarify") {
    return {
      ok: true,
      dryRun: true,
      source: "LivingIntentPlan",
      intentKind: LIVING_INTENT_KIND.CLARIFY,
      confidence: meaning?.confidence || "medium",
      reason: "meaning_requested_clarification",
      request,
      meaning,
    };
  }

  if (domain === "project" || intent === "project_message") {
    return {
      ok: true,
      dryRun: true,
      source: "LivingIntentPlan",
      intentKind: LIVING_INTENT_KIND.PROJECT_THINKING,
      confidence: meaning?.confidence || "medium",
      reason: "project_domain_meaning",
      request,
      meaning,
    };
  }

  if (domain === "memory") {
    return {
      ok: true,
      dryRun: true,
      source: "LivingIntentPlan",
      intentKind: LIVING_INTENT_KIND.MEMORY_THINKING,
      confidence: meaning?.confidence || "medium",
      reason: "memory_domain_meaning",
      request,
      meaning,
    };
  }

  if (safeText(request?.text)) {
    return {
      ok: true,
      dryRun: true,
      source: "LivingIntentPlan",
      intentKind: LIVING_INTENT_KIND.GENERAL_RESPONSE,
      confidence: meaning?.confidence || "medium",
      reason: "default_living_response",
      request,
      meaning,
    };
  }

  return {
    ok: false,
    dryRun: true,
    source: "LivingIntentPlan",
    intentKind: LIVING_INTENT_KIND.UNKNOWN,
    confidence: "low",
    reason: "empty_request_text",
    request,
    meaning,
  };
}

export default {
  LIVING_INTENT_KIND,
  createLivingIntentPlan,
};
