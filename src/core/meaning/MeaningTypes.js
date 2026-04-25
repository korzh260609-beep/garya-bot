// src/core/meaning/MeaningTypes.js
// ============================================================================
// CORE MEANING — Shared Types / Constants (SKELETON)
// Purpose:
// - define stable meaning-level structures for SG core
// - keep modules from hardcoding phrase-driven behavior
// - describe user intent, missing information, policies and planning hints
// IMPORTANT:
// - NO DB writes
// - NO external calls
// - NO hardcoded user replies
// ============================================================================

export const MEANING_DOMAIN = Object.freeze({
  GENERAL: "general",
  PROJECT: "project",
  MEMORY: "memory",
  CODE: "code",
  UNKNOWN: "unknown",
});

export const MEANING_ACTION = Object.freeze({
  ANSWER: "answer",
  CLARIFY: "clarify",
  PLAN: "plan",
  USE_TOOL: "use_tool",
  REFUSE: "refuse",
  WAIT: "wait",
});

export const MEANING_CONFIDENCE = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
});

export function createEmptyMeaning({ source = "MeaningEngine" } = {}) {
  return {
    ok: true,
    dryRun: true,
    source,
    domain: MEANING_DOMAIN.UNKNOWN,
    intent: "unknown",
    confidence: MEANING_CONFIDENCE.LOW,
    confidenceScore: 0,
    userMeaning: "",
    enoughInformation: false,
    missingInformation: [],
    suggestedAction: MEANING_ACTION.CLARIFY,
    extracted: {},
    policy: {
      doNotGuessMissingInformation: true,
      hardcodedReplyAllowed: false,
      naturalResponseRequired: true,
    },
    toolHints: [],
    warnings: [],
  };
}

export default {
  MEANING_DOMAIN,
  MEANING_ACTION,
  MEANING_CONFIDENCE,
  createEmptyMeaning,
};
