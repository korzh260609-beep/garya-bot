// src/core/projectIntent/modes/human/projectIntentHumanCapabilitySelector.js
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { HUMAN_PROJECT_INTENT_KINDS } from "./projectIntentHumanMeaning.js";

export const HUMAN_PROJECT_CAPABILITIES = Object.freeze({
  ANSWER_FROM_REPO_STATE: "answer_from_repo_state",
  EXPLAIN_MODULE: "explain_module",
  SUMMARIZE_ARCHITECTURE: "summarize_architecture",
  IDENTIFY_RISK: "identify_risk",
  SUGGEST_NEXT_STEP: "suggest_next_step",
  EXPLAIN_SOURCES: "explain_sources",
  ASK_CLARIFICATION: "ask_clarification",
  NONE: "none",
});

function selectCapabilityForIntentKind(intentKind) {
  switch (intentKind) {
    case HUMAN_PROJECT_INTENT_KINDS.SOURCE_QUESTION:
      return HUMAN_PROJECT_CAPABILITIES.EXPLAIN_SOURCES;
    case HUMAN_PROJECT_INTENT_KINDS.REPO_STATUS_QUESTION:
    case HUMAN_PROJECT_INTENT_KINDS.PROJECT_ANALYSIS:
      return HUMAN_PROJECT_CAPABILITIES.ANSWER_FROM_REPO_STATE;
    case HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION:
      return HUMAN_PROJECT_CAPABILITIES.SUMMARIZE_ARCHITECTURE;
    case HUMAN_PROJECT_INTENT_KINDS.MODULE_QUESTION:
    case HUMAN_PROJECT_INTENT_KINDS.FILE_OR_AREA_QUESTION:
      return HUMAN_PROJECT_CAPABILITIES.EXPLAIN_MODULE;
    case HUMAN_PROJECT_INTENT_KINDS.RISK_QUESTION:
      return HUMAN_PROJECT_CAPABILITIES.IDENTIFY_RISK;
    case HUMAN_PROJECT_INTENT_KINDS.NEXT_STEP_QUESTION:
      return HUMAN_PROJECT_CAPABILITIES.SUGGEST_NEXT_STEP;
    case HUMAN_PROJECT_INTENT_KINDS.UNKNOWN:
    default:
      return HUMAN_PROJECT_CAPABILITIES.ASK_CLARIFICATION;
  }
}

export function selectHumanProjectCapability({ meaning = null, repoFacts = null } = {}) {
  if (repoFacts?.ok !== true) {
    return {
      mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
      capability: HUMAN_PROJECT_CAPABILITIES.NONE,
      ready: false,
      reason: "repo_facts_required_before_capability_selection",
    };
  }

  const intentKind = meaning?.intentKind || HUMAN_PROJECT_INTENT_KINDS.UNKNOWN;
  const capability = selectCapabilityForIntentKind(intentKind);

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    capability,
    ready: capability !== HUMAN_PROJECT_CAPABILITIES.NONE,
    reason: "human_capability_selected_from_structured_meaning",
  };
}

export default {
  HUMAN_PROJECT_CAPABILITIES,
  selectHumanProjectCapability,
};
