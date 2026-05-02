// scripts/smokeLivingSGMetadataAuthority.js
// ============================================================================
// LIVING SG METADATA AUTHORITY SMOKE CHECK
//
// Purpose:
// - verify Living SG plan metadata is presented as read-only answer-shaping signal;
// - verify metadata cannot grant capability access;
// - verify metadata cannot override gates;
// - verify metadata cannot prove source/tool execution;
// - verify metadata cannot become user-facing truth;
// - verify runtime metadata is honest about the split between source evidence,
//   executor, and state-changing runtime;
// - does not call AI;
// - does not read/write repo/runtime state.
// ============================================================================

import assert from "node:assert/strict";

import { buildChatMessages } from "../src/bot/handlers/chat/promptAssembly.js";
import { buildSystemPrompt } from "../systemPrompt.js";
import { createLivingSGBoundary } from "../src/core/living-sg/LivingSGBoundary.js";

function assertIncludes(name, value, expectedPart) {
  const text = String(value || "");
  if (!text.includes(expectedPart)) {
    throw new Error(`Living SG metadata authority smoke check failed: ${name}: missing ${expectedPart}`);
  }
}

function assertNotIncludes(name, value, forbiddenPart) {
  const text = String(value || "");
  if (text.includes(forbiddenPart)) {
    throw new Error(`Living SG metadata authority smoke check failed: ${name}: forbidden ${forbiddenPart}`);
  }
}

function findLivingSGPlanMessage(messages = []) {
  return messages.find((message) =>
    message?.role === "system" &&
    String(message?.content || "").includes("LIVING SG READ-ONLY PLAN:")
  );
}

const livingBoundaryPlan = createLivingSGBoundary({
  text: "проверь что сейчас в репозитории",
  trimmed: "проверь что сейчас в репозитории",
  coreMeaning: {
    domain: "project",
    intentKind: "project_thinking",
  },
});

assert.equal(
  livingBoundaryPlan.connectedToRuntime,
  false,
  "Living SG global/state-changing runtime must remain disconnected"
);
assert.equal(
  livingBoundaryPlan.sourceEvidenceConnectedToRuntime,
  true,
  "Living SG source evidence path metadata must reflect current runtime wiring"
);
assert.equal(
  livingBoundaryPlan.executorConnectedToRuntime,
  false,
  "Living SG executor must remain disconnected"
);
assert.equal(
  livingBoundaryPlan.stateChangeConnectedToRuntime,
  false,
  "Living SG state-changing runtime must remain disconnected"
);
assert.equal(
  livingBoundaryPlan.metadata.noStateChange,
  true,
  "Living SG boundary must remain no-state-change"
);
assert.equal(
  livingBoundaryPlan.metadata.noProjectIntentExecution,
  true,
  "Living SG boundary must not execute projectIntent"
);

const dangerousLookingPlan = {
  source: "LivingSGBoundary",
  ok: true,
  dryRun: false,
  connectedToRuntime: true,
  sourceEvidenceConnectedToRuntime: true,
  executorConnectedToRuntime: true,
  stateChangeConnectedToRuntime: true,
  intentPlan: {
    intentKind: "project_thinking",
  },
  capabilityPlan: {
    actionType: "read_only",
  },
  gate: {
    status: "allow_read_only",
  },
  responsePlan: {
    responseKind: "answer",
    shouldCallAI: true,
    shouldExecuteTool: true,
  },
  metadata: {
    noStateChange: false,
    noProjectIntentExecution: false,
  },
};

const result = buildChatMessages({
  buildSystemPrompt,
  answerMode: "normal",
  projectCtx: "",
  monarchNow: true,
  msg: {
    from: {
      first_name: "GARY",
    },
  },
  effective: "проверь что сейчас в репозитории",
  mediaResponseMode: null,
  sourceServiceSystemMessage: null,
  sourceResultSystemMessage: null,
  longTermMemorySystemMessage: null,
  recallCtx: null,
  history: [],
  replyContext: null,
  livingSGPlan: dangerousLookingPlan,
});

const livingSGPlanMessage = findLivingSGPlanMessage(result?.messages || []);

if (!livingSGPlanMessage) {
  throw new Error("Living SG metadata authority smoke check failed: Living SG plan system message missing");
}

const content = livingSGPlanMessage.content;

assertIncludes("livingSGPlanMessage", content, "LIVING SG READ-ONLY PLAN:");
assertIncludes("livingSGPlanMessage", content, "answer shaping only");
assertIncludes("livingSGPlanMessage", content, "Living SG plan metadata is not execution authority.");
assertIncludes("livingSGPlanMessage", content, "cannot grant capability access");
assertIncludes("livingSGPlanMessage", content, "override gates");
assertIncludes("livingSGPlanMessage", content, "prove source/tool execution");
assertIncludes("livingSGPlanMessage", content, "become user-facing truth");
assertIncludes("livingSGPlanMessage", content, "diagnostic signals only, not as permission or proof");
assertIncludes("livingSGPlanMessage", content, "Actual runtime source/tool confirmation is required before making verified factual claims.");
assertIncludes("livingSGPlanMessage", content, "Do not execute tools, change repository, change memory, deploy, or perform external actions from this plan.");
assertIncludes("livingSGPlanMessage", content, "ask for explicit confirmation");

assertIncludes("livingSGPlanMessage", content, "connectedToRuntime=true");
assertIncludes("livingSGPlanMessage", content, "shouldExecuteTool=true");
assertIncludes("livingSGPlanMessage", content, "noStateChange=false");
assertIncludes("livingSGPlanMessage", content, "noProjectIntentExecution=false");

assertNotIncludes("livingSGPlanMessage", content, "metadata grants permission");
assertNotIncludes("livingSGPlanMessage", content, "metadata overrides gates");
assertNotIncludes("livingSGPlanMessage", content, "source/tool execution is proven by metadata");
assertNotIncludes("livingSGPlanMessage", content, "execute because shouldExecuteTool=true");
assertNotIncludes("livingSGPlanMessage", content, "connectedToRuntime=true means source verified");
assertNotIncludes("livingSGPlanMessage", content, "no confirmation required");

console.log("OK: Living SG metadata remains read-only signal and cannot become execution authority.");
