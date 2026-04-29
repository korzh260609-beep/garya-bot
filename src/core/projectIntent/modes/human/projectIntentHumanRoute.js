// src/core/projectIntent/modes/human/projectIntentHumanRoute.js
// ============================================================================
// HUMAN MODE PROJECT INTENT ROUTE BOUNDARY
//
// Purpose:
// - reserve a separate route boundary for future Human Mode project work.
// - keep normal SG conversation separated from Technical Mode legacy routes.
//
// Current status:
// - intentionally minimal.
// - no slash-command routing.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";
import { resolveProjectIntentHumanScope } from "./projectIntentHumanScope.js";

export function resolveProjectIntentHumanRoute({ text } = {}) {
  const scope = resolveProjectIntentHumanScope({ text });

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    scope,
    routeKey: "human_project_intent_not_implemented",
    policy: "human_project_intent_future",
    allowed: false,
    blocked: false,
    readOnly: true,
    needsConfirmation: false,
    reason:
      "Human Mode project routing is intentionally not implemented in this legacy split step. Future implementation must use meaning/context/permissions and RepoStateAgent-backed facts.",
  };
}

export default {
  resolveProjectIntentHumanRoute,
};
