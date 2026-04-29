// src/core/projectIntent/modes/human/conversation/projectIntentHumanRepliesRuntime.js
// ============================================================================
// HUMAN MODE CONVERSATION REPLIES RUNTIME BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode boundary for future natural repo/project reply
//   runtime backed by RepoStateAgent facts.
// - keep legacy technical reply runtime out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export async function replyHumanModeRuntimeNotImplemented() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_replies_runtime_not_implemented",
  };
}

export default {
  replyHumanModeRuntimeNotImplemented,
};
