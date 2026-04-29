// src/core/projectIntent/modes/human/conversation/projectIntentHumanStructuredRead.js
// ============================================================================
// HUMAN MODE STRUCTURED REPO FILE READ BOUNDARY
//
// Purpose:
// - reserve a separate Human Mode boundary for future natural repo/file answers.
// - keep slash-command extraction and command-list logic out of Human Mode.
//
// Current status:
// - intentionally minimal.
// - no slash-command extraction.
// - no exact phrase/keyword/regex routing.
// - no global SemanticRouter yet.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../../projectIntentInterfaceModes.js";

export function resolveHumanStructuredRepoFileAnswer({ text, targetPath, content } = {}) {
  void text;
  void targetPath;
  void content;

  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    ok: false,
    kind: "human_structured_repo_file_answer_not_implemented",
    text: "",
    extracted: {},
    reason:
      "Human Mode structured repo/file answers are intentionally not implemented in this legacy split step. Future implementation must use meaning/context/permissions and RepoStateAgent-backed facts.",
  };
}

export default {
  resolveHumanStructuredRepoFileAnswer,
};
