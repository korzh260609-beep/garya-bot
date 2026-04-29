// src/core/projectIntent/modes/human/projectIntentHumanFollowUpResolver.js
// ============================================================================
// HUMAN PROJECT FOLLOW-UP RESOLVER — SKELETON
//
// Purpose:
// - detect whether Human Mode has a previous structured decision available.
// - prepare future follow-up handling based on runtime context, not words.
//
// Hard rules:
// - no keyword matching.
// - no phrase matching.
// - no regex routing.
// - no raw user text interpretation.
// - no DB writes.
// - no AI calls.
// - no repo scans.
// - no final response generation here.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

function isValidPreviousDecisionTrace(value = null) {
  return Boolean(
    value &&
    typeof value === "object" &&
    value.mode === PROJECT_INTENT_INTERFACE_MODES.HUMAN &&
    value.ok === true &&
    value.source === "human_project_decision_trace_v1"
  );
}

export function resolveHumanProjectFollowUp({
  context = null,
  previousDecisionTrace = null,
} = {}) {
  const trace = previousDecisionTrace || context?.previousHumanProjectDecisionTrace || null;
  const previousDecisionTraceAvailable = isValidPreviousDecisionTrace(trace);

  return {
    ok: true,
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    source: "human_project_follow_up_resolver_v1",
    isFollowUp: false,
    previousDecisionTraceAvailable,
    followUpTarget: previousDecisionTraceAvailable ? "last_human_project_decision" : null,
    previousDecisionTrace: previousDecisionTraceAvailable ? trace : null,
    policy: {
      noKeywordMatching: true,
      noPhraseMatching: true,
      noRegexRouting: true,
      noRawTextInterpretation: true,
      contextOnlySkeleton: true,
    },
  };
}

export default {
  resolveHumanProjectFollowUp,
};
