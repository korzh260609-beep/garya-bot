// src/core/projectIntent/modes/human/conversation/projectIntentHumanObjectActions.js
// ============================================================================
// HUMAN MODE CONVERSATION OBJECT ACTIONS BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode boundary for future natural repo object
//   actions.
// - keep legacy technical semantic-plan object actions out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export async function handleHumanOpenTargetIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_open_target_not_implemented",
  };
}

export async function handleHumanExplainLikeIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_explain_like_not_implemented",
  };
}

export default {
  handleHumanOpenTargetIntent,
  handleHumanExplainLikeIntent,
};
