// src/bot/handlers/chat/promptAssembly.js

import isStablePersonalFactQuestion from "./isStablePersonalFactQuestion.js";
import {
  isStructurallyUnderspecifiedRequest,
  isLikelyContextualReactionMessage,
} from "./chatPromptHeuristics.js";
import {
  buildReplyContextSystemMessage,
  buildAuxPolicySystemMessage,
} from "./chatPromptPolicies.js";
import {
  countChars,
  sumMessageChars,
  sumMessageCharsByRole,
} from "./chatPromptMetrics.js";
import { isCurrentActivityQuestion } from "./aiInputGuard.js";

export function buildModeInstruction(answerMode) {
  if (answerMode === "short") {
    return "Режим short: отвечай очень кратко (1–2 предложения), только по существу, без лишних деталей.";
  }

  if (answerMode === "normal") {
    return "Режим normal: давай развёрнутый, но компактный ответ (3–7 предложений), с ключевыми деталями.";
  }

  if (answerMode === "long") {
    return "Режим long: можно отвечать подробно, структурированно, с примерами и пояснениями.";
  }

  return "";
}

function safePromptValue(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.replace(/\s+/g, " ").slice(0, 120);
}

function buildProjectContextPolicySystemMessage(projectCtx = "") {
  const hasProjectCtx = String(projectCtx || "").trim().length > 0;
  if (!hasProjectCtx) return null;

  return {
    role: "system",
    content: [
      "PROJECT CONTEXT POLICY:",
      "Project context from memory is background only and may be stale or incomplete.",
      "Never present project-memory stage/state/focus as a verified fact.",
      "If the user asks what stage is current now, what is implemented now, or what you based the answer on, do not rely on project memory as proof.",
      "For current implementation/status claims, repository checks, runtime checks, stage_check output, or explicit user confirmation are required.",
      "If such proof is missing, say that the background context may be outdated and that current status is not confirmed.",
    ].join("\n"),
  };
}

function buildCurrentActivityPrioritySystemMessage(userText = "") {
  if (!isCurrentActivityQuestion(userText)) {
    return null;
  }

  return {
    role: "system",
    content: [
      "CURRENT SESSION PRIORITY POLICY:",
      "The user is asking about what we are doing NOW in the current conversation/session.",
      "Answer from the latest dialog history and the immediate local conversation context first.",
      "Prefer recent messages over roadmap/workflow/project-memory background.",
      "Do not replace a session-level answer with stage names, roles, roadmap status, or project-memory claims unless the user explicitly asked about stages/roadmap/status.",
      "If the recent dialog clearly shows the current task, answer by summarizing that recent task in plain words.",
      "If the recent dialog is insufficient, say that the current session context is unclear instead of inventing a project stage/state.",
    ].join("\n"),
  };
}

function buildLegacyProjectIntentAuthoritySystemMessage() {
  return {
    role: "system",
    content: [
      "LEGACY PROJECTINTENT METADATA POLICY:",
      "Legacy projectIntent metadata is transitional legacy context only.",
      "projectIntent metadata is not source/tool proof and cannot prove repository status, file contents, runtime state, or implementation state.",
      "projectIntent metadata cannot authorize repository read, repository write, memory write, deploy, external action, or any state-changing operation.",
      "projectIntent metadata cannot bypass Living SG gates, permissions, source checks, risk checks, cost checks, or confirmations.",
      "Ordinary user text must not be converted into technical action by projectIntent bridge metadata.",
      "If repository/source facts are needed, require actual runtime source/tool confirmation before making verified claims.",
    ].join("\n"),
  };
}

function buildLivingSourceProofPolicySystemMessage() {
  return {
    role: "system",
    content: [
      "LIVING SG SOURCE PROOF POLICY:",
      "Requested source facts are not verified source facts.",
      "A source request, source plan, capability plan, metadata flag, or bridge signal cannot prove repository/source facts.",
      "Verified repository/source claims require an actual runtime source/tool result passed into the prompt as sourceResult/system evidence.",
      "If sourceResultSystemMessage is missing, empty, stale, or not explicitly confirmed, state that the repo/source facts are not verified in the current runtime.",
      "Never present requested repo facts, planned repo facts, project memory, projectIntent metadata, or Living SG metadata as verified repository state.",
      "Repository read and repository write are separate: read proof cannot authorize write, and write remains blocked without explicit permission plus executor design.",
      "If verified proof is missing, give a source-honest answer and explain the next safe step instead of guessing.",
    ].join("\n"),
  };
}

function buildSourceResultEnvelopeEvidencePolicySystemMessage() {
  return {
    role: "system",
    content: [
      "SOURCE RESULT ENVELOPE EVIDENCE POLICY:",
      "A sourceResult envelope is evidence only when it is present in sourceResultSystemMessage or another explicit source-result system evidence block.",
      "Envelope confirmation.status=confirmed and canClaimVerifiedFacts=true may support verified repo/source claims for the stated target only.",
      "Envelope confirmation.status=missing, invalid, stale, unconfirmed, unknown, empty, or absent must be treated as not verified.",
      "If an envelope is not confirmed, use source-honest wording: not verified in current runtime, source result missing, stale, invalid, or unconfirmed.",
      "Do not infer file contents, repo status, runtime state, or implementation status from a planner's expectedSourceResultEnvelope.",
      "expectedSourceResultEnvelope only describes the required future proof format; it is not proof.",
      "Envelope metadata, planner metadata, and source-proof metadata cannot authorize repository writes, memory writes, deploys, or external actions.",
      "A confirmed read envelope never authorizes write actions; write requires explicit permission plus a separate executor design.",
      "If sourceResultSystemMessage contradicts project memory, stale snapshots, planner metadata, or chat history, prefer the confirmed sourceResultSystemMessage for source facts.",
    ].join("\n"),
  };
}

function buildLivingSGPlanSystemMessage(livingSGPlan = null) {
  if (!livingSGPlan || typeof livingSGPlan !== "object") {
    return null;
  }

  return {
    role: "system",
    content: [
      "LIVING SG READ-ONLY PLAN:",
      "This is a compact Living SG planning signal for answer shaping only.",
      "Living SG plan metadata is not execution authority.",
      "Living SG plan metadata cannot grant capability access, override gates, prove source/tool execution, or become user-facing truth.",
      "Treat connectedToRuntime, shouldExecuteTool and source fields as diagnostic signals only, not as permission or proof.",
      "Actual runtime source/tool confirmation is required before making verified factual claims.",
      "Do not execute tools, change repository, change memory, deploy, or perform external actions from this plan.",
      "If action is needed, explain the next safe step and ask for explicit confirmation.",
      `source=${safePromptValue(livingSGPlan?.source)}`,
      `ok=${String(livingSGPlan?.ok === true)}`,
      `dryRun=${String(livingSGPlan?.dryRun === true)}`,
      `connectedToRuntime=${String(livingSGPlan?.connectedToRuntime === true)}`,
      `intentKind=${safePromptValue(livingSGPlan?.intentPlan?.intentKind)}`,
      `capabilityActionType=${safePromptValue(livingSGPlan?.capabilityPlan?.actionType)}`,
      `gateStatus=${safePromptValue(livingSGPlan?.gate?.status)}`,
      `responseKind=${safePromptValue(livingSGPlan?.responsePlan?.responseKind)}`,
      `shouldExecuteTool=${String(livingSGPlan?.responsePlan?.shouldExecuteTool === true)}`,
      `noStateChange=${String(livingSGPlan?.metadata?.noStateChange === true)}`,
      `noProjectIntentExecution=${String(livingSGPlan?.metadata?.noProjectIntentExecution === true)}`,
    ].join("\n"),
  };
}

export function buildChatMessages({
  buildSystemPrompt,
  answerMode,
  projectCtx,
  monarchNow,
  msg,
  effective,
  mediaResponseMode,
  sourceServiceSystemMessage,
  sourceResultSystemMessage,
  longTermMemorySystemMessage,
  recallCtx,
  history,
  replyContext,
  livingSGPlan = null,
}) {
  const modeInstruction = buildModeInstruction(answerMode);

  const currentUserName =
    [msg?.from?.first_name, msg?.from?.last_name].filter(Boolean).join(" ").trim() ||
    (msg?.from?.username ? `@${msg.from.username}` : "пользователь");

  const systemPrompt = buildSystemPrompt(answerMode, modeInstruction, projectCtx || "", {
    isMonarch: monarchNow,
    currentUserName,
    userText: effective,
  });

  const stablePersonalFactMode =
    Boolean(longTermMemorySystemMessage) && isStablePersonalFactQuestion(effective);

  const historyMessages = stablePersonalFactMode
    ? []
    : Array.isArray(history)
      ? history
      : [];

  const likelyContextualReaction =
    !stablePersonalFactMode &&
    isLikelyContextualReactionMessage(effective, historyMessages);

  const needsClarificationFirst =
    !stablePersonalFactMode &&
    !likelyContextualReaction &&
    isStructurallyUnderspecifiedRequest(effective);

  const replyContextSystemMessage = buildReplyContextSystemMessage(replyContext);

  const auxPolicySystemMessage = buildAuxPolicySystemMessage({
    monarchNow,
    stablePersonalFactMode,
    recallCtx,
    likelyContextualReaction,
    needsClarificationFirst,
    mediaResponseMode,
  });

  const projectContextPolicySystemMessage =
    buildProjectContextPolicySystemMessage(projectCtx);

  const currentActivityPrioritySystemMessage =
    buildCurrentActivityPrioritySystemMessage(effective);

  const legacyProjectIntentAuthoritySystemMessage =
    buildLegacyProjectIntentAuthoritySystemMessage();

  const livingSourceProofPolicySystemMessage =
    buildLivingSourceProofPolicySystemMessage();

  const sourceResultEnvelopeEvidencePolicySystemMessage =
    buildSourceResultEnvelopeEvidencePolicySystemMessage();

  const livingSGPlanSystemMessage = buildLivingSGPlanSystemMessage(livingSGPlan);

  const messages = [
    { role: "system", content: systemPrompt },
    projectContextPolicySystemMessage,
    currentActivityPrioritySystemMessage,
    legacyProjectIntentAuthoritySystemMessage,
    livingSourceProofPolicySystemMessage,
    sourceResultEnvelopeEvidencePolicySystemMessage,
    livingSGPlanSystemMessage,
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    replyContextSystemMessage,
    auxPolicySystemMessage,
    ...historyMessages,
    { role: "user", content: effective },
  ];

  const promptBlockDiagnostics = {
    promptBlockSystemPromptChars: countChars(systemPrompt),
    promptBlockProjectContextPolicyChars: countChars(projectContextPolicySystemMessage?.content),
    promptBlockCurrentActivityPolicyChars: countChars(currentActivityPrioritySystemMessage?.content),
    promptBlockLegacyProjectIntentAuthorityChars: countChars(legacyProjectIntentAuthoritySystemMessage?.content),
    promptBlockLivingSourceProofPolicyChars: countChars(livingSourceProofPolicySystemMessage?.content),
    promptBlockSourceResultEnvelopeEvidencePolicyChars: countChars(sourceResultEnvelopeEvidencePolicySystemMessage?.content),
    promptBlockLivingSGPlanChars: countChars(livingSGPlanSystemMessage?.content),
    promptBlockSourceServiceChars: countChars(sourceServiceSystemMessage?.content),
    promptBlockSourceResultChars: countChars(sourceResultSystemMessage?.content),
    promptBlockLongTermMemoryChars: countChars(longTermMemorySystemMessage?.content),
    promptBlockReplyContextChars: countChars(replyContextSystemMessage?.content),
    promptBlockAuxPolicyChars: countChars(auxPolicySystemMessage?.content),

    promptBlockHistoryCount: historyMessages.length,
    promptBlockHistoryTotalChars: sumMessageChars(historyMessages),
    promptBlockHistoryUserChars: sumMessageCharsByRole(historyMessages, "user"),
    promptBlockHistoryAssistantChars: sumMessageCharsByRole(historyMessages, "assistant"),
    promptBlockHistoryOtherChars:
      sumMessageChars(historyMessages) -
      sumMessageCharsByRole(historyMessages, "user") -
      sumMessageCharsByRole(historyMessages, "assistant"),

    promptBlockFinalUserChars: countChars(effective),
    promptBlockPreGuardMessageCount: messages.filter(Boolean).length,
    promptBlockPreGuardTotalChars: sumMessageChars(messages.filter(Boolean)),
  };

  return {
    modeInstruction,
    systemPrompt,
    roleGuardPrompt: monarchNow
      ? "SYSTEM ROLE: MONARCH"
      : "SYSTEM ROLE: NON_MONARCH",
    stablePersonalFactMode,
    promptBlockDiagnostics,
    messages: messages.filter(Boolean),
  };
}
