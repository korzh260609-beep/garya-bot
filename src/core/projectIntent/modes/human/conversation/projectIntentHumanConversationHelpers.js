// src/core/projectIntent/modes/human/conversation/projectIntentHumanConversationHelpers.js
// ============================================================================
// HUMAN MODE CONVERSATION HELPER BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode helper boundary for future meaning/context
//   follow-up understanding.
// - keep exact phrase/includes active-file helper logic out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function shouldHumanForceActiveFileExplain({ trimmed, followupContext, semanticPlan } = {}) {
  void trimmed;
  void followupContext;
  void semanticPlan;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    forced: false,
    reason: "human_active_file_followup_not_implemented",
    note:
      "Human Mode active-file follow-up handling is intentionally not implemented in this legacy split step. Future implementation must use meaning/context/permissions and RepoStateAgent-backed facts.",
  };
}

export default {
  shouldHumanForceActiveFileExplain,
};
