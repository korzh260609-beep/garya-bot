// src/core/projectIntent/modes/human/conversation/projectIntentHumanBootstrap.js
// ============================================================================
// HUMAN MODE CONVERSATION BOOTSTRAP BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode bootstrap boundary for future natural
//   repo/project conversation.
// - keep legacy Technical Mode snapshot bootstrap out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact routeKey dependency.
// - no old snapshot truth claims.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export async function prepareHumanRepoConversationRuntime() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    handled: false,
    reason: "human_repo_conversation_bootstrap_not_implemented",
  };
}

export default {
  prepareHumanRepoConversationRuntime,
};
