// scripts/smokePendingClarificationContinuationGate.js
// ============================================================================
// Smoke — Pending Clarification Continuation Gate
//
// Verifies:
// - new independent task releases the message to Living SG path;
// - direct clarification answer continues pending flow;
// - invalid AI JSON releases safely instead of hijacking the chat.
// ============================================================================

import assert from "node:assert/strict";

import {
  resolvePendingClarificationContinuationGate,
} from "../src/bot/handlers/chat/pendingClarificationContinuationGate.js";

const pending = {
  kind: "document_estimate_source",
  question: "О каком недавнем документе идёт речь?",
  payload: {},
};

const releaseResult = await resolvePendingClarificationContinuationGate({
  pending,
  userText: "Сколько модулей в репозитории?",
  callAI: async () => JSON.stringify({
    relation: "new_independent_task",
    shouldContinuePending: false,
    shouldReleaseToLivingChat: true,
    shouldClearPending: true,
    confidence: 0.94,
    reason: "user asks a new repository facts question, not a document clarification answer",
  }),
});

assert.equal(releaseResult.ok, true);
assert.equal(releaseResult.shouldContinuePending, false);
assert.equal(releaseResult.shouldReleaseToLivingChat, true);
assert.equal(releaseResult.shouldClearPending, true);
assert.equal(releaseResult.relation, "new_independent_task");

const continueResult = await resolvePendingClarificationContinuationGate({
  pending,
  userText: "Про последний PDF, который я отправлял",
  callAI: async () => JSON.stringify({
    relation: "continues_pending",
    shouldContinuePending: true,
    shouldReleaseToLivingChat: false,
    shouldClearPending: false,
    confidence: 0.91,
    reason: "user directly identifies the recent document for the pending clarification",
  }),
});

assert.equal(continueResult.ok, true);
assert.equal(continueResult.shouldContinuePending, true);
assert.equal(continueResult.shouldReleaseToLivingChat, false);
assert.equal(continueResult.shouldClearPending, false);
assert.equal(continueResult.relation, "continues_pending");

const invalidJsonResult = await resolvePendingClarificationContinuationGate({
  pending,
  userText: "Какая структура репозитория?",
  callAI: async () => "not json",
});

assert.equal(invalidJsonResult.shouldContinuePending, false);
assert.equal(invalidJsonResult.shouldReleaseToLivingChat, true);
assert.equal(invalidJsonResult.shouldClearPending, false);
assert.equal(invalidJsonResult.reason, "json_parse_failed");

console.log("Smoke Pending Clarification Continuation Gate — OK");
