// scripts/smokeLivingSGSourceProofBoundary.js
// ============================================================================
// LIVING SG SOURCE PROOF BOUNDARY SMOKE CHECK
//
// Purpose:
// - verify requested source facts are not treated as verified source facts;
// - verify source proof skeleton does not call repo/runtime/tools;
// - verify verified claims require sourceResultConfirmed=true and payload;
// - verify promptAssembly includes the Living SG source proof policy;
// - verify missing sourceResultSystemMessage cannot be treated as verified proof.
// ============================================================================

import {
  LIVING_SOURCE_PROOF_KIND,
  LIVING_SOURCE_PROOF_STATUS,
  createLivingSourceProofBoundary,
} from "../src/core/living-sg/LivingSourceProofBoundary.js";
import { buildChatMessages } from "../src/bot/handlers/chat/promptAssembly.js";
import { buildSystemPrompt } from "../systemPrompt.js";

function assertEqual(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG source proof smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertBool(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`Living SG source proof smoke check failed: ${name}: expected ${expected}, got ${actual}`);
  }
}

function assertFunction(name, value) {
  if (typeof value !== "function") {
    throw new Error(`Living SG source proof smoke check failed: ${name} is not a function`);
  }
}

function assertIncludes(name, value, expectedPart) {
  const text = String(value || "");
  if (!text.includes(expectedPart)) {
    throw new Error(`Living SG source proof smoke check failed: ${name}: missing ${expectedPart}`);
  }
}

function findSourceProofPolicyMessage(messages = []) {
  return messages.find((message) =>
    message?.role === "system" &&
    String(message?.content || "").includes("LIVING SG SOURCE PROOF POLICY:")
  );
}

assertFunction("createLivingSourceProofBoundary", createLivingSourceProofBoundary);

assertEqual("kind.repo", LIVING_SOURCE_PROOF_KIND.REPO, "repo");
assertEqual(
  "status.requestedNotVerified",
  LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED,
  "requested_not_verified"
);
assertEqual("status.verified", LIVING_SOURCE_PROOF_STATUS.VERIFIED, "verified");

const notRequested = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_PROOF_KIND.REPO,
  requested: false,
  sourceResultConfirmed: false,
  sourcePayload: null,
});

assertBool("notRequested.ok", notRequested.ok, true);
assertBool("notRequested.dryRun", notRequested.dryRun, true);
assertEqual("notRequested.status", notRequested.status, LIVING_SOURCE_PROOF_STATUS.NOT_REQUESTED);
assertBool("notRequested.requested", notRequested.requested, false);
assertBool("notRequested.verified", notRequested.verified, false);
assertBool("notRequested.canClaimVerifiedFacts", notRequested.canClaimVerifiedFacts, false);
assertBool("notRequested.metadata.noSourceCall", notRequested.metadata.noSourceCall, true);
assertBool("notRequested.metadata.noRuntimeRepoRead", notRequested.metadata.noRuntimeRepoRead, true);
assertBool("notRequested.metadata.noRuntimeRepoWrite", notRequested.metadata.noRuntimeRepoWrite, true);
assertBool("notRequested.metadata.noExecutor", notRequested.metadata.noExecutor, true);
assertBool("notRequested.metadata.noRepoStateAgentRuntime", notRequested.metadata.noRepoStateAgentRuntime, true);
assertBool("notRequested.metadata.noTechnicalModeExpansion", notRequested.metadata.noTechnicalModeExpansion, true);
assertBool("notRequested.metadata.noSlashCommandsAdded", notRequested.metadata.noSlashCommandsAdded, true);

const requestedButNotVerified = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_PROOF_KIND.REPO,
  requested: true,
  sourceResultConfirmed: false,
  sourcePayload: null,
});

assertBool("requestedButNotVerified.ok", requestedButNotVerified.ok, true);
assertBool("requestedButNotVerified.dryRun", requestedButNotVerified.dryRun, true);
assertEqual(
  "requestedButNotVerified.status",
  requestedButNotVerified.status,
  LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED
);
assertBool("requestedButNotVerified.requested", requestedButNotVerified.requested, true);
assertBool("requestedButNotVerified.verified", requestedButNotVerified.verified, false);
assertBool("requestedButNotVerified.canClaimVerifiedFacts", requestedButNotVerified.canClaimVerifiedFacts, false);
assertBool("requestedButNotVerified.requiresSourceResult", requestedButNotVerified.requiresSourceResult, true);

const confirmedWithoutPayload = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_PROOF_KIND.REPO,
  requested: true,
  sourceResultConfirmed: true,
  sourcePayload: null,
});

assertEqual(
  "confirmedWithoutPayload.status",
  confirmedWithoutPayload.status,
  LIVING_SOURCE_PROOF_STATUS.REQUESTED_NOT_VERIFIED
);
assertBool("confirmedWithoutPayload.verified", confirmedWithoutPayload.verified, false);
assertBool("confirmedWithoutPayload.canClaimVerifiedFacts", confirmedWithoutPayload.canClaimVerifiedFacts, false);

const verified = createLivingSourceProofBoundary({
  kind: LIVING_SOURCE_PROOF_KIND.REPO,
  requested: true,
  sourceResultConfirmed: true,
  sourcePayload: {
    repository: "korzh260609-beep/garya-bot",
    ref: "main",
  },
});

assertBool("verified.ok", verified.ok, true);
assertBool("verified.dryRun", verified.dryRun, true);
assertEqual("verified.status", verified.status, LIVING_SOURCE_PROOF_STATUS.VERIFIED);
assertBool("verified.requested", verified.requested, true);
assertBool("verified.verified", verified.verified, true);
assertBool("verified.canClaimVerifiedFacts", verified.canClaimVerifiedFacts, true);
assertBool("verified.requiresSourceResult", verified.requiresSourceResult, false);
assertBool("verified.metadata.noSourceCall", verified.metadata.noSourceCall, true);
assertBool("verified.metadata.noRuntimeRepoRead", verified.metadata.noRuntimeRepoRead, true);
assertBool("verified.metadata.noRuntimeRepoWrite", verified.metadata.noRuntimeRepoWrite, true);
assertBool("verified.metadata.noExecutor", verified.metadata.noExecutor, true);
assertBool("verified.metadata.noRepoStateAgentRuntime", verified.metadata.noRepoStateAgentRuntime, true);

const promptResult = buildChatMessages({
  buildSystemPrompt,
  answerMode: "normal",
  projectCtx: "",
  monarchNow: true,
  msg: { from: { first_name: "GARY" } },
  effective: "проверь что сейчас в репозитории",
  mediaResponseMode: null,
  sourceServiceSystemMessage: null,
  sourceResultSystemMessage: null,
  longTermMemorySystemMessage: null,
  recallCtx: null,
  history: [],
  replyContext: null,
  livingSGPlan: {
    source: "LivingSGBoundary",
    ok: true,
    dryRun: true,
    connectedToRuntime: false,
    responsePlan: { shouldExecuteTool: false },
    metadata: { noStateChange: true, noProjectIntentExecution: true },
  },
});

const sourceProofPolicyMessage = findSourceProofPolicyMessage(promptResult?.messages || []);

if (!sourceProofPolicyMessage) {
  throw new Error("Living SG source proof smoke check failed: prompt policy message missing");
}

const content = sourceProofPolicyMessage.content;
assertIncludes("sourceProofPolicyMessage", content, "LIVING SG SOURCE PROOF POLICY:");
assertIncludes("sourceProofPolicyMessage", content, "Requested source facts are not verified source facts.");
assertIncludes("sourceProofPolicyMessage", content, "cannot prove repository/source facts");
assertIncludes("sourceProofPolicyMessage", content, "Verified repository/source claims require an actual runtime source/tool result");
assertIncludes("sourceProofPolicyMessage", content, "sourceResult/system evidence");
assertIncludes("sourceProofPolicyMessage", content, "If sourceResultSystemMessage is missing");
assertIncludes("sourceProofPolicyMessage", content, "repo/source facts are not verified in the current runtime");
assertIncludes("sourceProofPolicyMessage", content, "Never present requested repo facts");
assertIncludes("sourceProofPolicyMessage", content, "read proof cannot authorize write");
assertIncludes("sourceProofPolicyMessage", content, "source-honest answer");

if (promptResult?.promptBlockDiagnostics?.promptBlockLivingSourceProofPolicyChars <= 0) {
  throw new Error("Living SG source proof smoke check failed: diagnostics char count missing");
}

console.log("OK: Living SG source proof boundary separates requested facts from verified source evidence.");
