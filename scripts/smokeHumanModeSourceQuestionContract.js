// scripts/smokeHumanModeSourceQuestionContract.js
// ============================================================================
// Smoke — Human Mode Source Question Contract
//
// Verifies that Human Mode has a consistent structured contract for source
// questions without adding keyword/phrase routing or Technical Mode behavior.
// ============================================================================

import assert from "node:assert/strict";

import {
  HUMAN_PROJECT_INTENT_KINDS,
  classifyHumanProjectIntentMeaning,
} from "../src/core/projectIntent/modes/human/projectIntentHumanMeaning.js";
import {
  HUMAN_PROJECT_CAPABILITIES,
  selectHumanProjectCapability,
} from "../src/core/projectIntent/modes/human/projectIntentHumanCapabilitySelector.js";

const meaning = await classifyHumanProjectIntentMeaning({
  text: "",
  context: {
    humanProjectIntentMeaning: {
      intentKind: HUMAN_PROJECT_INTENT_KINDS.SOURCE_QUESTION,
      confidence: "structured",
      reason: "smoke_structured_source_question",
    },
  },
});

assert.equal(
  HUMAN_PROJECT_INTENT_KINDS.SOURCE_QUESTION,
  "source_question",
  "SOURCE_QUESTION must exist in Human Mode intent kinds"
);
assert.equal(
  meaning.intentKind,
  HUMAN_PROJECT_INTENT_KINDS.SOURCE_QUESTION,
  "structured SOURCE_QUESTION must normalize as a valid Human Mode meaning"
);

const capability = selectHumanProjectCapability({
  meaning,
  repoFacts: {
    ok: true,
    facts: {
      repo: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "main",
      },
      totals: {
        files: 0,
        modules: 0,
        dependencies: 0,
      },
    },
  },
});

assert.equal(capability.ready, true, "SOURCE_QUESTION capability must be ready when repo facts exist");
assert.equal(
  capability.capability,
  HUMAN_PROJECT_CAPABILITIES.EXPLAIN_SOURCES,
  "SOURCE_QUESTION must select EXPLAIN_SOURCES"
);
assert.equal(
  capability.reason,
  "human_capability_selected_from_structured_meaning",
  "source question capability must come from structured meaning, not keywords"
);

console.log("Smoke Human Mode source question contract — OK");
