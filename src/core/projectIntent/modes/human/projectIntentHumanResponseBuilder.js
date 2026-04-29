// src/core/projectIntent/modes/human/projectIntentHumanResponseBuilder.js
// ============================================================================
// HUMAN MODE RESPONSE BUILDER SKELETON
//
// Purpose:
// - future human-readable response builder for Human Mode repo/project work.
// - must not expose debug protocol unless explicitly requested.
// - must not use old Technical Mode template replies as Human Mode intelligence.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function buildHumanProjectIntentResponse({ permissions, meaning, repoFacts, capability } = {}) {
  void permissions;
  void meaning;
  void repoFacts;
  void capability;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    text: "Human Mode project response builder is not implemented yet.",
    reason: "human_response_builder_not_implemented",
  };
}

export default {
  buildHumanProjectIntentResponse,
};
