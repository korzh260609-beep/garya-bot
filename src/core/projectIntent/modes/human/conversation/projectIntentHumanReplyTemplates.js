// src/core/projectIntent/modes/human/conversation/projectIntentHumanReplyTemplates.js
// ============================================================================
// HUMAN MODE REPLY TEMPLATES BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode reply template boundary for future natural
//   repo/project conversation.
// - keep legacy Technical Mode human-readable templates out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function buildHumanReplyTemplate() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    reason: "human_reply_templates_not_implemented",
    text: "",
  };
}

export default {
  buildHumanReplyTemplate,
};
