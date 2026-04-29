// src/core/projectIntent/modes/human/conversation/projectIntentHumanAiGuard.js
// ============================================================================
// HUMAN MODE AI GROUNDING GUARD BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode guard boundary for future meaning/context-based
//   grounding checks.
// - keep deterministic legacy pattern/includes checks out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function detectHumanRepoExplainGroundingFailure({ aiReply, content } = {}) {
  void aiReply;
  void content;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    failed: false,
    reason: "human_grounding_guard_not_implemented",
    matchedPatterns: [],
    note:
      "Human Mode grounding guard is intentionally not implemented in this legacy split step. Future implementation must use meaning/context/permissions and RepoStateAgent-backed facts.",
  };
}

export default {
  detectHumanRepoExplainGroundingFailure,
};
