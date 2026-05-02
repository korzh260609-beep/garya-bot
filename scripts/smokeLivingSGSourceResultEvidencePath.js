// scripts/smokeLivingSGSourceResultEvidencePath.js
// ============================================================================
// Smoke — Living SG Source Result Evidence Path
//
// Behavior-level smoke for the current evidence path without executing source
// runtime:
//
// existing legacy sourceResult
// → adaptLegacySourceResultToEnvelope()
// → sourceResultEnvelope
// → buildChatMessages()
// → SOURCE RESULT SYSTEM EVIDENCE
//
// Boundaries:
// - no source execution;
// - no repo-read runtime;
// - no executor;
// - no deploy;
// - no slash-command dependency.
// ============================================================================

import assert from "node:assert/strict";

import { buildChatMessages } from "../src/bot/handlers/chat/promptAssembly.js";
import {
  adaptLegacySourceResultToEnvelope,
} from "../src/core/living-sg/LivingSourceResultEnvelopeAdapter.js";

function buildSystemPrompt(answerMode, modeInstruction, projectCtx, opts = {}) {
  return [
    "TEST SYSTEM PROMPT",
    `answerMode=${answerMode}`,
    modeInstruction,
    projectCtx,
    String(opts?.userText || ""),
  ].filter(Boolean).join("\n");
}

function baseChatInput(overrides = {}) {
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
    effective: "Проверь source evidence path",
    mediaResponseMode: null,
    sourceServiceSystemMessage: null,
    sourceResultSystemMessage: null,
    sourceResultEnvelope: null,
    longTermMemorySystemMessage: null,
    recallCtx: null,
    history: [],
    replyContext: null,
    livingSGPlan: null,
    ...overrides,
  };
}

function findSourceEvidence(messages) {
  return messages.find((message) =>
    String(message?.content || "").includes("SOURCE RESULT SYSTEM EVIDENCE:")
  );
}

const adapterResult = adaptLegacySourceResultToEnvelope({
  sourceCtx: {
    shouldUseSourceResult: true,
    sourcePlan: {
      decision: "legacy_source_result",
    },
    sourceResult: {
      ok: true,
      sourceKey: "github_repo_status",
      content: "verified repo-source content from already-existing legacy sourceResult",
      fetchedAt: "2026-05-02T06:45:00Z",
      meta: {
        repository: "korzh260609-beep/garya-bot",
        ref: "main",
        path: "src/bot/handlers/chat/sourceFlow.js",
        scope: "repo_file",
      },
    },
  },
});

assert.equal(adapterResult.ok, true, "adapter must accept valid existing legacy sourceResult");
assert.ok(adapterResult.sourceResultEnvelope, "adapter must produce a sourceResultEnvelope");
assert.equal(
  adapterResult.sourceResultEnvelope.canClaimVerifiedFacts,
  true,
  "valid adapted sourceResultEnvelope must allow verified source claims for stated target"
);
assert.equal(
  adapterResult.sourceResultEnvelope.canAuthorizeWrite,
  false,
  "adapted sourceResultEnvelope must not authorize writes"
);
assert.equal(
  adapterResult.metadata.noSourceCall,
  true,
  "adapter path must not execute sources"
);
assert.equal(
  adapterResult.metadata.noRuntimeRepoRead,
  true,
  "adapter path must not read repo runtime"
);
assert.equal(
  adapterResult.metadata.noExecutor,
  true,
  "adapter path must not create/use executor"
);

const chatResult = buildChatMessages(baseChatInput({
  sourceResultEnvelope: adapterResult.sourceResultEnvelope,
}));

const sourceEvidence = findSourceEvidence(chatResult.messages);

assert.ok(
  sourceEvidence,
  "buildChatMessages must generate SOURCE RESULT SYSTEM EVIDENCE from adapted envelope"
);
assert.equal(sourceEvidence.role, "system");
assert.ok(sourceEvidence.content.includes("status=confirmed"));
assert.ok(sourceEvidence.content.includes("verified=true"));
assert.ok(sourceEvidence.content.includes("canClaimVerifiedFacts=true"));
assert.ok(sourceEvidence.content.includes("canAuthorizeWrite=false"));
assert.ok(sourceEvidence.content.includes("kind=repo"));
assert.ok(sourceEvidence.content.includes("repository=korzh260609-beep/garya-bot"));
assert.ok(sourceEvidence.content.includes("path=src/bot/handlers/chat/sourceFlow.js"));
assert.ok(sourceEvidence.content.includes("does not execute sources"));
assert.ok(sourceEvidence.content.includes("read repositories"));
assert.ok(sourceEvidence.content.includes("A confirmed read result never authorizes write actions"));

assert.equal(
  chatResult.promptBlockDiagnostics.promptBlockSourceResultGenerated,
  true,
  "prompt diagnostics must mark generated source evidence"
);
assert.equal(
  chatResult.promptBlockDiagnostics.promptBlockSourceResultSource,
  "generated_from_source_result_envelope",
  "prompt diagnostics must identify envelope evidence source"
);
assert.ok(
  chatResult.promptBlockDiagnostics.promptBlockSourceResultChars > 0,
  "prompt diagnostics must count generated source evidence chars"
);

const legacyManualMessage = {
  role: "system",
  content: "SOURCE RESULT:\n- legacy fallback should win only when passed manually",
};

const manualResult = buildChatMessages(baseChatInput({
  sourceResultSystemMessage: legacyManualMessage,
  sourceResultEnvelope: adapterResult.sourceResultEnvelope,
}));

assert.equal(
  manualResult.promptBlockDiagnostics.promptBlockSourceResultGenerated,
  false,
  "manual sourceResultSystemMessage must still preserve manual precedence if explicitly provided"
);
assert.equal(
  manualResult.promptBlockDiagnostics.promptBlockSourceResultSource,
  "manual_source_result_system_message",
  "manual precedence diagnostics must remain intact"
);

console.log("Smoke Living SG Source Result Evidence Path — OK");
