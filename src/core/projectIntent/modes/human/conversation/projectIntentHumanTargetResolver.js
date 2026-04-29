// src/core/projectIntent/modes/human/conversation/projectIntentHumanTargetResolver.js
// ============================================================================
// HUMAN MODE TARGET RESOLVER BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode target resolver boundary for future natural
//   repo/project conversation.
// - keep legacy Technical Mode semantic-plan target resolution out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export async function resolveHumanTargetObject() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    reason: "human_target_resolver_not_implemented",
  };
}

export default {
  resolveHumanTargetObject,
};
