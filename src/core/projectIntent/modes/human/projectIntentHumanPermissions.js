// src/core/projectIntent/modes/human/projectIntentHumanPermissions.js
// ============================================================================
// HUMAN MODE PERMISSIONS SKELETON
//
// Purpose:
// - permission boundary for future Human Mode repo/project work.
// - must stay separate from Technical Mode legacy route checks.
// - must not use phrase/keyword/regex routing.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function checkHumanProjectIntentPermissions({
  isMonarchUser = false,
  isPrivateChat = false,
} = {}) {
  const allowed = isMonarchUser === true && isPrivateChat === true;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    allowed,
    blocked: !allowed,
    requiresMonarch: true,
    requiresPrivate: true,
    reason: allowed
      ? "human_project_permissions_allowed"
      : "human_project_permissions_denied_monarch_private_required",
  };
}

export default {
  checkHumanProjectIntentPermissions,
};
