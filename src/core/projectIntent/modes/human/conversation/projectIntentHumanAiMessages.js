// src/core/projectIntent/modes/human/conversation/projectIntentHumanAiMessages.js
// ============================================================================
// HUMAN MODE AI MESSAGES BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode prompt/message boundary for future natural
//   repo/project conversation backed by RepoStateAgent facts.
// - keep legacy Technical Mode repo/file prompt rules out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function buildHumanAiMessages() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    reason: "human_ai_messages_not_implemented",
    messages: [],
  };
}

export default {
  buildHumanAiMessages,
};
