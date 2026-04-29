// src/core/projectIntent/modes/human/projectIntentHumanReadPlan.js
// ============================================================================
// HUMAN MODE PROJECT INTENT READ PLAN BOUNDARY
//
// Purpose:
// - reserve a separate read-plan boundary for future Human Mode project work.
// - keep normal SG conversation separated from Technical Mode legacy read plans.
//
// Current status:
// - intentionally minimal.
// - no slash-command routing.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function resolveProjectIntentHumanReadPlan({ text } = {}) {
  void text;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    status: "not_implemented",
    planKey: "human_project_read_plan_not_implemented",
    allowed: false,
    blocked: false,
    needsClarification: false,
    reason:
      "Human Mode project read planning is intentionally not implemented in this legacy split step. Future implementation must use meaning/context/permissions and RepoStateAgent-backed facts.",
  };
}

export default {
  resolveProjectIntentHumanReadPlan,
};
