// src/core/projectIntent/modes/human/conversation/projectIntentHumanContextMeta.js
// ============================================================================
// HUMAN MODE CONVERSATION CONTEXT META BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode metadata boundary for future natural
//   repo/project conversation.
// - keep legacy Technical Mode context metadata out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function buildHumanContextMeta() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    reason: "human_context_meta_not_implemented",
  };
}

export default {
  buildHumanContextMeta,
};
