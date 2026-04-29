// src/core/projectIntent/modes/human/conversation/projectIntentHumanRepoActions.js
// ============================================================================
// HUMAN MODE CONVERSATION REPO ACTIONS BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode boundary for future natural repo/project
//   actions backed by RepoStateAgent facts.
// - keep legacy technical semantic-plan repo actions out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export async function handleHumanRepoStatusIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_repo_status_not_implemented",
  };
}

export async function handleHumanShowTreeIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_show_tree_not_implemented",
  };
}

export async function handleHumanBrowseFolderIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_browse_folder_not_implemented",
  };
}

export async function handleHumanFindTargetIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_find_target_not_implemented",
  };
}

export async function handleHumanFindAndExplainIntent() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    handled: false,
    reason: "human_find_and_explain_not_implemented",
  };
}

export default {
  handleHumanRepoStatusIntent,
  handleHumanShowTreeIntent,
  handleHumanBrowseFolderIntent,
  handleHumanFindTargetIntent,
  handleHumanFindAndExplainIntent,
};
