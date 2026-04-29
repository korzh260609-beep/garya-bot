// src/core/projectIntent/modes/human/projectIntentHumanRepoFacts.js
// ============================================================================
// HUMAN MODE REPO FACTS SKELETON
//
// Purpose:
// - future RepoStateAgent-backed factual layer for Human Mode repo/project work.
// - must not use old RepoIndex, old hardcoded maps, or old snapshot outputs as
//   current factual truth.
// - must not import Technical Mode legacy routing.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export function loadHumanProjectRepoFacts() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    source: "RepoStateAgent",
    facts: null,
    reason: "human_repo_facts_not_implemented",
  };
}

export default {
  loadHumanProjectRepoFacts,
};
