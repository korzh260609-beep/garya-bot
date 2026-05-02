// scripts/smokeRepoFactsSourceHonestyGuard.js
// ============================================================================
// Smoke — Repo Facts Source-Honesty Guard
//
// Verifies runtime enforcement of existing no-fantasy/source-first policy:
// - current repo facts questions do not fall through to generic AI;
// - guard stays technical and does not build user-facing fallback text;
// - explicit imagination/hypothetical requests may still use generic AI;
// - invalid classifier JSON fails open for non-enforcement rather than crashing.
// ============================================================================

import assert from "node:assert/strict";

import {
  guardRepoFactsSourceHonesty,
} from "../src/core/living-sg/LivingRepoFactsSourceHonestyGuard.js";

const livingSGPlan = {
  intentPlan: {
    intentKind: "project_thinking",
  },
};

const deterministicRepoAnswer = {
  handled: false,
  reason: "repo_facts_answer_kind_missing",
};

const factualRootListing = await guardRepoFactsSourceHonesty({
  livingSGPlan,
  deterministicRepoAnswer,
  sourceResultEnvelope: null,
  userText: "Сколько папок и файлов в корне репозитория, скажи количество и названия",
  callAI: async () => JSON.stringify({
    requiresCurrentRepoFacts: true,
    explicitlyRequestsImagination: false,
    factNeed: "repo_root_listing",
    mayUseGenericAI: false,
    confidence: 0.96,
    reason: "user asks for current repository root listing facts",
  }),
});

assert.equal(factualRootListing.handled, true);
assert.equal(factualRootListing.shouldBlockGenericAiFacts, true);
assert.equal(factualRootListing.shouldAllowGenericAi, false);
assert.equal(factualRootListing.factNeed, "repo_root_listing");
assert.equal(factualRootListing.text, undefined);
assert.equal(factualRootListing.metadata.noUserFacingText, true);

const guardJson = JSON.stringify(factualRootListing);
assert.ok(!guardJson.includes("setup.py"));
assert.ok(!guardJson.includes("requirements.txt"));
assert.ok(!guardJson.includes("LICENSE"));
assert.ok(!guardJson.includes("Не буду придумывать."));
assert.ok(!guardJson.includes("deterministic verified answer"));
assert.ok(!guardJson.includes("Причина bypass"));

const explicitImagination = await guardRepoFactsSourceHonesty({
  livingSGPlan,
  deterministicRepoAnswer,
  sourceResultEnvelope: null,
  userText: "Придумай пример структуры репозитория для нового проекта",
  callAI: async () => JSON.stringify({
    requiresCurrentRepoFacts: false,
    explicitlyRequestsImagination: true,
    factNeed: "none",
    mayUseGenericAI: true,
    confidence: 0.92,
    reason: "user explicitly asks for hypothetical example",
  }),
});

assert.equal(explicitImagination.handled, false);
assert.equal(explicitImagination.shouldAllowGenericAi, true);

const invalidJson = await guardRepoFactsSourceHonesty({
  livingSGPlan,
  deterministicRepoAnswer,
  sourceResultEnvelope: null,
  userText: "Объясни идею проекта без конкретной структуры repo",
  callAI: async () => "not-json",
});

assert.equal(invalidJson.handled, false);
assert.equal(invalidJson.shouldAllowGenericAi, true);
assert.equal(invalidJson.reason, "semantic_guard_json_parse_failed");

console.log("Smoke Repo Facts Source-Honesty Guard — OK");
