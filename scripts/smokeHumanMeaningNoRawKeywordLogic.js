// scripts/smokeHumanMeaningNoRawKeywordLogic.js
// ============================================================================
// Smoke — Human Meaning No Raw Keyword Logic
//
// Verifies that Human Mode meaning does not derive intent from raw user text,
// phrases, keywords, or ungated provider execution.
// ============================================================================

import assert from "node:assert/strict";
import fs from "node:fs";

import {
  HUMAN_PROJECT_INTENT_KINDS,
  classifyHumanProjectIntentMeaning,
} from "../src/core/projectIntent/modes/human/projectIntentHumanMeaning.js";

const source = fs.readFileSync(
  new URL("../src/core/projectIntent/modes/human/projectIntentHumanMeaning.js", import.meta.url),
  "utf8"
);

assert.equal(
  source.includes(".includes("),
  false,
  "Human meaning must not use raw keyword includes checks"
);
assert.equal(
  source.includes("toLowerCase("),
  false,
  "Human meaning must not lowercase raw text for keyword routing"
);
assert.equal(
  source.includes("combined"),
  false,
  "Human meaning must not combine raw text/userMeaning for keyword routing"
);

const rawKeywordMeaning = await classifyHumanProjectIntentMeaning({
  text: "repo architecture risk next module github репозитор архитектура риск дальше модуль",
  context: {},
});

assert.equal(
  rawKeywordMeaning.intentKind,
  HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
  "raw text keywords must not select Human Mode intent"
);
assert.equal(
  rawKeywordMeaning.reason,
  "human_meaning_not_implemented",
  "raw text without structured meaning must stay unimplemented/unknown"
);

const structuredMeaning = await classifyHumanProjectIntentMeaning({
  text: "",
  context: {
    coreMeaning: {
      humanProjectIntentKind: HUMAN_PROJECT_INTENT_KINDS.RISK_QUESTION,
    },
  },
});

assert.equal(
  structuredMeaning.intentKind,
  HUMAN_PROJECT_INTENT_KINDS.RISK_QUESTION,
  "structured core meaning may select Human Mode intent"
);
assert.equal(
  structuredMeaning.reason,
  "derived_from_structured_core_meaning_intent_kind",
  "structured core meaning must be the derivation source"
);

const projectContextMeaning = await classifyHumanProjectIntentMeaning({
  text: "ordinary text does not matter",
  context: {
    coreMeaning: {
      domain: "project",
      intent: "project_message",
    },
  },
});

assert.equal(
  projectContextMeaning.intentKind,
  HUMAN_PROJECT_INTENT_KINDS.PROJECT_ANALYSIS,
  "structured project context may select project analysis"
);
assert.equal(
  projectContextMeaning.reason,
  "derived_from_structured_core_meaning_project_context",
  "project analysis must come from structured core meaning"
);

const blockedProviderMeaning = await classifyHumanProjectIntentMeaning({
  text: "",
  context: {
    humanMeaningProvider: async () => ({
      intentKind: HUMAN_PROJECT_INTENT_KINDS.ARCHITECTURE_QUESTION,
    }),
  },
});

assert.equal(
  blockedProviderMeaning.intentKind,
  HUMAN_PROJECT_INTENT_KINDS.UNKNOWN,
  "ungated provider must not select intent"
);
assert.equal(
  blockedProviderMeaning.reason,
  "human_meaning_provider_present_but_not_allowed",
  "ungated provider must be explicitly blocked"
);

console.log("Smoke Human meaning no raw keyword logic — OK");
