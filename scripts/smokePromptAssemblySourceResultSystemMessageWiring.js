// scripts/smokePromptAssemblySourceResultSystemMessageWiring.js
// ============================================================================
// Smoke — Prompt Assembly Source Result System Message Wiring
//
// Verifies that promptAssembly can build sourceResultSystemMessage from an
// explicitly provided sourceResult envelope without executing anything, while
// preserving manually supplied sourceResultSystemMessage precedence.
// ============================================================================

import assert from "node:assert/strict";

import { buildChatMessages } from "../src/bot/handlers/chat/promptAssembly.js";
import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
  LIVING_SOURCE_RESULT_KIND,
  createLivingSourceResultEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

function buildSystemPrompt(answerMode, modeInstruction, projectCtx, opts = {}) {
  return [
    "TEST SYSTEM PROMPT",
    `answerMode=${answerMode}`,
    modeInstruction,
    projectCtx,
    String(opts?.userText || ""),
  ].filter(Boolean).join("\n");
}

function baseInput(overrides = {}) {
  return {
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
    sourceResultSystemMessage: null,
    longTermMemorySystemMessage: null,
    recallCtx: null,
    history: [],
    replyContext: null,
    livingSGPlan: null,
    ...overrides,
  };
}

function findSourceResultEvidence(messages) {
  return messages.find((message) =>
    String(message?.content || "").includes("SOURCE RESULT SYSTEM EVIDENCE:")
  );
}

const confirmedEnvelope = createLivingSourceResultEnvelope({
  kind: LIVING_SOURCE_RESULT_KIND.REPO,
  target: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
    path: "package.json",
    scope: "repo_file",
  },
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-01T20:00:00Z",
  sourceUpdatedAt: "2026-05-01T19:45:00Z",
  payload: { path: "package.json", sha: "example-sha" },
  valid: true,
  confirmed: true,
  confirmedBy: "explicit-test-envelope",
  reason: "explicit_envelope_provided_to_prompt_assembly",
});

const generatedResult = buildChatMessages(baseInput({
  sourceResultEnvelope: confirmedEnvelope,
}));

const generatedEvidence = findSourceResultEvidence(generatedResult.messages);

assert.ok(generatedEvidence, "prompt assembly must generate source result system evidence from explicit envelope");
assert.ok(generatedEvidence.content.includes("status=confirmed"));
assert.ok(generatedEvidence.content.includes("verified=true"));
assert.ok(generatedEvidence.content.includes("canAuthorizeWrite=false"));
assert.ok(generatedEvidence.content.includes("does not execute sources"));
assert.ok(generatedEvidence.content.includes("read repositories"));
assert.equal(
  generatedResult.promptBlockDiagnostics.promptBlockSourceResultGenerated,
  true,
  "diagnostics must mark generated source result message"
);
assert.equal(
  generatedResult.promptBlockDiagnostics.promptBlockSourceResultSource,
  "generated_from_source_result_envelope",
  "diagnostics must identify generated source result envelope path"
);
assert.ok(
  generatedResult.promptBlockDiagnostics.promptBlockSourceResultChars > 0,
  "diagnostics must count generated source result message chars"
);

const manualMessage = {
  role: "system",
  content: [
    "MANUAL SOURCE RESULT SYSTEM MESSAGE:",
    "manual-precedence=true",
    "SOURCE RESULT SYSTEM EVIDENCE: manual block intentionally wins",
  ].join("\n"),
};

const manualResult = buildChatMessages(baseInput({
  sourceResultSystemMessage: manualMessage,
  sourceResultEnvelope: confirmedEnvelope,
}));

const manualEvidence = manualResult.messages.find((message) =>
  String(message?.content || "").includes("MANUAL SOURCE RESULT SYSTEM MESSAGE:")
);

assert.ok(manualEvidence, "manual sourceResultSystemMessage must remain present");
assert.equal(
  manualEvidence.content,
  manualMessage.content,
  "manual sourceResultSystemMessage content must not be replaced by generated evidence"
);
assert.equal(
  manualResult.promptBlockDiagnostics.promptBlockSourceResultGenerated,
  false,
  "manual sourceResultSystemMessage must keep generated=false"
);
assert.equal(
  manualResult.promptBlockDiagnostics.promptBlockSourceResultSource,
  "manual_source_result_system_message",
  "manual sourceResultSystemMessage must keep precedence diagnostics"
);

const missingResult = buildChatMessages(baseInput());

assert.equal(
  findSourceResultEvidence(missingResult.messages),
  undefined,
  "prompt assembly must not create missing-envelope evidence when no explicit envelope/result is provided"
);
assert.equal(
  missingResult.promptBlockDiagnostics.promptBlockSourceResultGenerated,
  false,
  "missing explicit envelope must keep generated=false"
);
assert.equal(
  missingResult.promptBlockDiagnostics.promptBlockSourceResultSource,
  "missing_source_result_evidence",
  "missing explicit envelope must keep source-result evidence missing"
);
assert.equal(
  missingResult.promptBlockDiagnostics.promptBlockSourceResultChars,
  0,
  "missing explicit envelope must not add source result chars"
);

console.log("Smoke Prompt Assembly Source Result System Message Wiring — OK");
