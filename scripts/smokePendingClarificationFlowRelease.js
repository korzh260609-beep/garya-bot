// scripts/smokePendingClarificationFlowRelease.js
// ============================================================================
// Smoke — Pending Clarification Flow Release
//
// Verifies the real pre-AI pending clarification flow releases a new independent
// task back to normal Living SG chat instead of sending an old clarification
// answer.
// ============================================================================

import assert from "node:assert/strict";

import {
  savePendingClarification,
  getPendingClarification,
  clearPendingClarification,
} from "../src/bot/handlers/chat/clarificationSessionCache.js";
import {
  continuePendingClarificationIfAny,
} from "../src/bot/handlers/chat/chatPendingClarificationFlow.js";

const chatId = 76001;
clearPendingClarification(chatId);

savePendingClarification({
  chatId,
  kind: "document_estimate_source",
  question: "О каком недавнем документе идёт речь?",
  payload: {},
});

let sentMessages = 0;
let savedEarlyReturns = 0;

const result = await continuePendingClarificationIfAny({
  bot: {
    sendMessage: async () => {
      sentMessages += 1;
    },
  },
  msg: {
    chat: {
      id: chatId,
    },
  },
  chatId,
  trimmed: "Сколько модулей в репозитории?",
  saveAssistantEarlyReturn: async () => {
    savedEarlyReturns += 1;
  },
  callAI: async () => JSON.stringify({
    relation: "new_independent_task",
    shouldContinuePending: false,
    shouldReleaseToLivingChat: true,
    shouldClearPending: true,
    confidence: 0.95,
    reason: "new independent repo facts request",
  }),
  FileIntake: {},
  chatIdStr: String(chatId),
  messageId: 1,
});

assert.equal(result.handled, false, "new independent task must be released to normal chat");
assert.equal(result.releasedToLivingChat, true, "flow must explicitly report release");
assert.equal(sentMessages, 0, "pending flow must not send old clarification text");
assert.equal(savedEarlyReturns, 0, "pending flow must not save an early return");
assert.equal(getPendingClarification(chatId), null, "clearable new task must clear stale pending state");

console.log("Smoke Pending Clarification Flow Release — OK");
