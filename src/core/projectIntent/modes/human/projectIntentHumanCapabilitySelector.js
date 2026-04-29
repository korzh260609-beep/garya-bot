// src/core/projectIntent/modes/human/projectIntentHumanCapabilitySelector.js
// ============================================================================
// HUMAN MODE CAPABILITY SELECTOR SKELETON
//
// Purpose:
// - future capability/action selection boundary for Human Mode repo/project work.
// - selects what SG should do after permissions, meaning and factual repo state.
// - must not use slash commands, exact phrases, keywords or regex routing.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export const HUMAN_PROJECT_CAPABILITIES = Object.freeze({
  ANSWER_FROM_REPO_STATE: "answer_from_repo_state",
  EXPLAIN_MODULE: "explain_module",
  SUMMARIZE_ARCHITECTURE: "summarize_architecture",
  IDENTIFY_RISK: "identify_risk",
  SUGGEST_NEXT_STEP: "suggest_next_step",
  ASK_CLARIFICATION: "ask_clarification",
  NONE: "none",
});

export function selectHumanProjectCapability() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    capability: HUMAN_PROJECT_CAPABILITIES.NONE,
    reason: "human_capability_selector_not_implemented",
  };
}

export default {
  HUMAN_PROJECT_CAPABILITIES,
  selectHumanProjectCapability,
};
