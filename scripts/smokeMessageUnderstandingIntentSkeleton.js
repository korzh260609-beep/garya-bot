// AGENT NOTE:
// Smoke for SG 2.0 message understanding intent skeleton.
// Purpose: prove structured intent passthrough without raw-text inference, keyword matching, phrase matching, AI inference, or tool calls.

import assert from "node:assert/strict";

process.env.MONARCH_USER_ID = process.env.MONARCH_USER_ID || "smoke_monarch";

const { handleMessage } = await import("../src/core/handleMessage.js");
const { handleMessageDiagnosticsRoute } = await import("../src/core/message/messageDiagnosticsRoute.js");
const {
  buildMessageUnderstandingContext,
  normalizeMessageIntent,
} = await import("../src/core/message/messageUnderstanding.js");

function assertNoInferenceRouting(understanding) {
  assert.equal(understanding.routing.keywordMatchingUsed, false);
  assert.equal(understanding.routing.phraseMatchingUsed, false);
  assert.equal(understanding.routing.aiInferenceUsed, false);
  assert.equal(understanding.safety.noTextInference, true);
  assert.equal(understanding.safety.noKeywordMatching, true);
  assert.equal(understanding.safety.noPhraseMatching, true);
  assert.equal(understanding.safety.noAiCall, true);
  assert.equal(understanding.safety.noToolCall, true);
  assert.equal(understanding.safety.noDbMutation, true);
  assert.equal(understanding.safety.noMemoryWrite, true);
}

function assertDiagnosticsIntent(intent) {
  assert.equal(intent.domain, "diagnostics");
  assert.equal(intent.action, "inspect");
  assert.equal(intent.target, "users");
  assert.equal(intent.capability, "users_identity_registry");
  assert.deepEqual(intent.checks, ["users_identity_registry"]);
  assert.equal(intent.source, "smoke");
}

const rawTextOnly = buildMessageUnderstandingContext({
  text: "СГ, проверь users_identity_registry и диагностику",
});

assert.equal(rawTextOnly.hasStructuredIntent, false);
assert.equal(rawTextOnly.intent, null);
assert.equal(rawTextOnly.routing.source, "none");
assertNoInferenceRouting(rawTextOnly);

const normalized = normalizeMessageIntent({
  domain: " Diagnostics ",
  action: " Inspect ",
  target: " Users ",
  capability: " users_identity_registry ",
  checks: [" users_identity_registry "],
  source: " smoke ",
});

assertDiagnosticsIntent(normalized);

const contextIntent = buildMessageUnderstandingContext({
  intent: {
    domain: "diagnostics",
    action: "inspect",
    target: "users",
    capability: "users_identity_registry",
    checks: ["users_identity_registry"],
    source: "smoke",
  },
});

assert.equal(contextIntent.hasStructuredIntent, true);
assert.equal(contextIntent.routing.source, "structured_intent");
assertDiagnosticsIntent(contextIntent.intent);
assertNoInferenceRouting(contextIntent);

const runtimeOptionsIntent = buildMessageUnderstandingContext({
  runtimeOptions: {
    intent: {
      domain: "diagnostics",
      action: "inspect",
      target: "users",
      capability: "users_identity_registry",
      checks: ["users_identity_registry"],
      source: "smoke",
    },
  },
});

assert.equal(runtimeOptionsIntent.hasStructuredIntent, true);
assertDiagnosticsIntent(runtimeOptionsIntent.intent);
assertNoInferenceRouting(runtimeOptionsIntent);

const understandingIntent = buildMessageUnderstandingContext({
  understanding: {
    intent: {
      domain: "diagnostics",
      action: "inspect",
      target: "users",
      capability: "users_identity_registry",
      checks: ["users_identity_registry"],
      source: "smoke",
    },
  },
});

assert.equal(understandingIntent.hasStructuredIntent, true);
assertDiagnosticsIntent(understandingIntent.intent);
assertNoInferenceRouting(understandingIntent);

const noStructuredIntentRoute = await handleMessageDiagnosticsRoute({
  text: "users_identity_registry diagnostics raw text must not route",
  identity: {
    isMonarch: true,
  },
});

assert.equal(noStructuredIntentRoute.handled, false);
assert.equal(noStructuredIntentRoute.reason, "no_structured_intent");
assert.equal(noStructuredIntentRoute.routing.keywordMatchingUsed, false);
assert.equal(noStructuredIntentRoute.routing.phraseMatchingUsed, false);

const handledViaHandleMessage = await handleMessage({
  transport: "smoke",
  userId: "smoke_monarch",
  text: "raw text must not decide diagnostics; structured intent does",
  intent: {
    domain: "diagnostics",
    action: "inspect",
    target: "users",
    capability: "users_identity_registry",
    checks: ["users_identity_registry"],
    source: "smoke",
  },
});

assert.equal(handledViaHandleMessage.diagnosticsRoute.handled, true);
assert.equal(handledViaHandleMessage.diagnosticsRoute.intent.domain, "diagnostics");
assert.equal(handledViaHandleMessage.diagnosticsRoute.checks.length, 1);
assert.equal(handledViaHandleMessage.diagnosticsRoute.checks[0], "users_identity_registry");
assert.equal(handledViaHandleMessage.understanding.hasStructuredIntent, true);
assertDiagnosticsIntent(handledViaHandleMessage.understanding.intent);
assertNoInferenceRouting(handledViaHandleMessage.understanding);

console.log("Smoke message understanding intent skeleton passed.");
