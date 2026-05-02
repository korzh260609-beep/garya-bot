// scripts/smokeRepoFactsSourceHonestyReplyBuilder.js
// ============================================================================
// Smoke — Repo Facts Source-Honesty Reply Builder
//
// Verifies that blocked repo facts get a user-facing Living SG reply,
// while technical guard reasons remain hidden from Telegram/user text.
// ============================================================================

import assert from "node:assert/strict";

import {
  buildRepoFactsSourceHonestyBlockedReply,
} from "../src/core/living-sg/LivingRepoFactsSourceHonestyReplyBuilder.js";

const sourceResultEnvelope = {
  canClaimVerifiedFacts: true,
  confirmation: {
    status: "confirmed",
  },
  payload: {
    projectMap: {
      repo: {
        fullName: "korzh260609-beep/garya-bot",
        branch: "main",
      },
      totals: {
        files: 1165,
        modules: 68,
        dependencies: 713,
        structureComplete: true,
      },
    },
  },
};

const reply = buildRepoFactsSourceHonestyBlockedReply({
  sourceResultEnvelope,
  guardResult: {
    handled: true,
    factNeed: "repo_root_listing",
    reason: "user asks for current repository root listing facts",
    deterministicRepoAnswerReason: "repo_facts_answer_kind_missing",
  },
});

assert.equal(reply.handled, true);
assert.equal(reply.source, "LivingRepoFactsSourceHonestyReplyBuilder");
assert.ok(reply.text.includes("Не буду придумывать."));
assert.ok(reply.text.includes("Я вижу подтверждённую карту репозитория"));
assert.ok(reply.text.includes("файлов всего: 1165"));
assert.ok(reply.text.includes("модулей: 68"));
assert.ok(reply.text.includes("Следующий шаг"));

assert.ok(!reply.text.includes("deterministic verified answer"));
assert.ok(!reply.text.includes("repo_facts_answer_kind_missing"));
assert.ok(!reply.text.includes("Причина bypass"));
assert.ok(!reply.text.includes("bypass deterministic builder"));
assert.ok(!reply.text.includes("setup.py"));
assert.ok(!reply.text.includes("requirements.txt"));
assert.ok(!reply.text.includes("LICENSE"));
assert.equal(reply.metadata.userFacingReplyBuiltSeparately, true);
assert.equal(reply.metadata.technicalGuardTextHidden, true);

console.log("Smoke Repo Facts Source-Honesty Reply Builder — OK");
