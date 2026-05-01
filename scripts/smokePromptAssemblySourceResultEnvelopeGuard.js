// scripts/smokePromptAssemblySourceResultEnvelopeGuard.js
// ============================================================================
// Smoke — Prompt Assembly Source Result Envelope Guard
//
// Verifies that promptAssembly includes a sourceResult envelope evidence policy
// that keeps source facts honest:
// - confirmed envelope can support verified source claims;
// - missing/invalid/stale/unconfirmed envelope blocks verified claims;
// - expectedSourceResultEnvelope is not proof;
// - envelope metadata cannot authorize writes.
// ============================================================================

import assert from "node:assert/strict";

import { buildChatMessages } from "../src/bot/handlers/chat/promptAssembly.js";

function buildSystemPrompt(answerMode, modeInstruction, projectCtx, opts = {}) {
  return [
    "TEST SYSTEM PROMPT",
    `answerMode=${answerMode}`,
    modeInstruction,
    projectCtx,
    String(opts?.userText || ""),
  ].filter(Boolean).join("\n");
}

const result = buildChatMessages({
  buildSystemPrompt,
  answerMode: "short",
  projectCtx: "",
  monarchNow: true,
  msg: {
    from: {
      first_name: "Gary",
    },
  },
  effective: "Проверь repo status",
  mediaResponseMode: null,
  sourceServiceSystemMessage: null,
  sourceResultSystemMessage: {
    role: "system",
    content: [
      "SOURCE RESULT:",
      "sourceResultEnvelope.confirmation.status=unconfirmed",
      "sourceResultEnvelope.canClaimVerifiedFacts=false",
    ].join("\n"),
  },
  longTermMemorySystemMessage: null,
  recallCtx: null,
  history: [],
  replyContext: null,
  livingSGPlan: null,
});

assert.equal(Array.isArray(result.messages), true);

const envelopePolicyMessage = result.messages.find((message) =>
  String(message?.content || "").includes("SOURCE RESULT ENVELOPE EVIDENCE POLICY:")
);

assert.ok(envelopePolicyMessage, "sourceResult envelope evidence policy must be present");

const policyText = envelopePolicyMessage.content;

assert.ok(
  policyText.includes("confirmation.status=confirmed"),
  "policy must define confirmed envelope behavior"
);
assert.ok(
  policyText.includes("confirmation.status=missing, invalid, stale, unconfirmed"),
  "policy must define unverified envelope statuses"
);
assert.ok(
  policyText.includes("expectedSourceResultEnvelope only describes the required future proof format"),
  "policy must prevent expectedSourceResultEnvelope from becoming proof"
);
assert.ok(
  policyText.includes("cannot authorize repository writes"),
  "policy must block write authority from envelope/planner metadata"
);
assert.ok(
  policyText.includes("A confirmed read envelope never authorizes write actions"),
  "policy must separate read proof from write authority"
);

assert.equal(
  typeof result.promptBlockDiagnostics.promptBlockSourceResultEnvelopeEvidencePolicyChars,
  "number",
  "diagnostics must include envelope policy char count"
);
assert.ok(
  result.promptBlockDiagnostics.promptBlockSourceResultEnvelopeEvidencePolicyChars > 0,
  "envelope policy diagnostics must be non-zero"
);

const sourceResultIndex = result.messages.findIndex((message) =>
  String(message?.content || "").includes("SOURCE RESULT:")
);
const envelopePolicyIndex = result.messages.findIndex((message) =>
  String(message?.content || "").includes("SOURCE RESULT ENVELOPE EVIDENCE POLICY:")
);

assert.ok(envelopePolicyIndex >= 0, "envelope policy index must exist");
assert.ok(sourceResultIndex >= 0, "source result message index must exist");
assert.ok(
  envelopePolicyIndex < sourceResultIndex,
  "envelope policy must appear before sourceResultSystemMessage"
);

console.log("Smoke Prompt Assembly Source Result Envelope Guard — OK");
