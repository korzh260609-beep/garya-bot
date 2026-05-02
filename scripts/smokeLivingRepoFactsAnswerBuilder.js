// scripts/smokeLivingRepoFactsAnswerBuilder.js
// ============================================================================
// Smoke — Living Repo Facts Answer Builder
//
// Verifies deterministic repo facts answers:
// - no AI call required;
// - uses only confirmed sourceResultEnvelope.payload.projectMap;
// - refuses to handle ordinary project-thinking without explicit repo facts kind;
// - refuses stale/unconfirmed source evidence.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";
import {
  LIVING_REPO_FACTS_ANSWER_KIND,
  buildLivingRepoFactsAnswer,
} from "../src/core/living-sg/LivingRepoFactsAnswerBuilder.js";

function createLivingSGPlan({ repoFactsAnswerKind = "" } = {}) {
  return {
    intentPlan: {
      intentKind: "project_thinking",
      meaning: {
        intent: repoFactsAnswerKind ? "repo_facts_question" : "project_message",
        extracted: repoFactsAnswerKind ? { repoFactsAnswerKind } : {},
      },
    },
  };
}

const confirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    scope: "repo_state_agent_project_map",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-02T14:10:00Z",
  sourceUpdatedAt: "2026-05-02T14:09:00Z",
  payload: {
    projectMap: {
      repo: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "main",
      },
      totals: {
        files: 127,
        modules: 13,
        dependencies: 42,
        structureComplete: true,
      },
      layers: {
        core: {
          filesCount: 33,
          sampleFiles: ["src/core/handleMessage/handleChatFlow.js"],
        },
      },
      modules: [
        {
          key: "src/core",
          rootPath: "src/core",
          filesCount: 33,
          sampleFiles: ["src/core/living-sg/LivingRepoFactsAnswerBuilder.js"],
        },
      ],
      entrypoints: [{ path: "index.js" }],
      criticalFiles: [{ path: "pillars/DECISIONS.md" }],
    },
  },
  valid: true,
  confirmed: true,
  confirmedBy: "runtime-source",
  reason: "runtime_source_result_confirmed",
});

const structureAnswer = buildLivingRepoFactsAnswer({
  sourceResultEnvelope: confirmedEnvelope,
  livingSGPlan: createLivingSGPlan({
    repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_STRUCTURE,
  }),
  repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_STRUCTURE,
});

assert.equal(structureAnswer.handled, true, "confirmed repo structure request must be handled deterministically");
assert.equal(structureAnswer.metadata.noAiCall, true, "repo facts answer must not need AI");
assert.equal(structureAnswer.metadata.noRepoRead, true, "builder must not read repo");
assert.equal(structureAnswer.metadata.noRepoWrite, true, "builder must not write repo");
assert.ok(structureAnswer.text.includes("файлов: 127"));
assert.ok(structureAnswer.text.includes("модулей: 13"));
assert.ok(structureAnswer.text.includes("Слои / зоны:"));
assert.ok(structureAnswer.text.includes("src/core/handleMessage/handleChatFlow.js"));
assert.ok(structureAnswer.text.includes("Модули:"));
assert.ok(structureAnswer.text.includes("src/core/living-sg/LivingRepoFactsAnswerBuilder.js"));
assert.ok(structureAnswer.text.includes("Я не добавляю типовые папки"));
assert.ok(!structureAnswer.text.includes("setup.py"), "builder must not invent setup.py");
assert.ok(!structureAnswer.text.includes("обычно"), "builder must not produce generic structure wording");

const fileCountAnswer = buildLivingRepoFactsAnswer({
  sourceResultEnvelope: confirmedEnvelope,
  livingSGPlan: createLivingSGPlan({
    repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_FILE_COUNT,
  }),
  repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_FILE_COUNT,
});

assert.equal(fileCountAnswer.handled, true, "confirmed repo file-count request must be handled deterministically");
assert.ok(fileCountAnswer.text.includes("файлов: 127"));
assert.ok(!fileCountAnswer.text.includes("Слои / зоны:"), "file-count answer should stay compact");

const ordinaryProjectThinking = buildLivingRepoFactsAnswer({
  sourceResultEnvelope: confirmedEnvelope,
  livingSGPlan: createLivingSGPlan(),
});

assert.equal(
  ordinaryProjectThinking.handled,
  false,
  "ordinary project-thinking must not be hijacked by deterministic repo facts answer"
);
assert.equal(
  ordinaryProjectThinking.reason,
  "repo_facts_answer_kind_missing",
  "ordinary project-thinking bypass reason must be explicit"
);

const staleEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: "repo_state_agent_project_map",
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.STALE,
  payload: {
    projectMap: {
      repo: { fullName: "korzh260609-beep/garya-bot", branch: "main" },
      totals: { files: 999 },
    },
  },
  valid: true,
  confirmed: true,
});

const staleAnswer = buildLivingRepoFactsAnswer({
  sourceResultEnvelope: staleEnvelope,
  livingSGPlan: createLivingSGPlan({
    repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_FILE_COUNT,
  }),
  repoFactsAnswerKind: LIVING_REPO_FACTS_ANSWER_KIND.REPO_FILE_COUNT,
});

assert.equal(staleAnswer.handled, false, "stale source evidence must not produce deterministic facts");
assert.equal(staleAnswer.reason, "source_result_envelope_not_confirmed");

console.log("Smoke Living Repo Facts Answer Builder — OK");
