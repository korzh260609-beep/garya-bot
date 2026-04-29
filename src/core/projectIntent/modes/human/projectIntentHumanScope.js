// src/core/projectIntent/modes/human/projectIntentHumanScope.js
// ============================================================================
// HUMAN MODE PROJECT INTENT SCOPE BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode boundary for future meaning-based SG project
//   understanding.
// - make it explicit that Human Mode must not call legacy phrase/token/prefix/
//   regex routing as normal intelligence.
//
// Current status:
// - intentionally minimal.
// - no phrase-bound routing.
// - no slash-command routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function resolveProjectIntentHumanScope() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    status: "not_implemented",
    routeKey: "human_project_intent_not_implemented",
    allowed: false,
    blocked: false,
    reason:
      "Human Mode project intent routing is intentionally not implemented in this legacy split step. Use RepoStateAgent-backed Human Mode later.",
  };
}

export default {
  resolveProjectIntentHumanScope,
};
