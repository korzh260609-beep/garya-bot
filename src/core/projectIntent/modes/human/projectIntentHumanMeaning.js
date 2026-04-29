// src/core/projectIntent/modes/human/projectIntentHumanMeaning.js
// ============================================================================
// HUMAN MODE MEANING SKELETON
//
// Purpose:
// - future meaning classification boundary for natural SG project/repo requests.
// - must not become a phrase router.
// - must not import Technical Mode legacy heuristics.
//
// Current status:
// - skeleton only.
// - not wired into runtime.
// ============================================================================

import { PROJECT_INTENT_INTERFACE_MODES } from "../projectIntentInterfaceModes.js";

export const HUMAN_PROJECT_INTENT_KINDS = Object.freeze({
  REPO_STATUS_QUESTION: "repo_status_question",
  ARCHITECTURE_QUESTION: "architecture_question",
  MODULE_QUESTION: "module_question",
  RISK_QUESTION: "risk_question",
  NEXT_STEP_QUESTION: "next_step_question",
  FILE_OR_AREA_QUESTION: "file_or_area_question",
  UNKNOWN: "unknown",
});

export function classifyHumanProjectIntentMeaning() {
  return {
    mode: PROJECT_INTENT_INTERFACE_MODES.HUMAN,
    intentKind: HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
    confidence: "none",
    reason: "human_meaning_not_implemented",
  };
}

export default {
  HUMAN_PROJECT_INTENT_KINDS,
  classifyHumanProjectIntentMeaning,
};
