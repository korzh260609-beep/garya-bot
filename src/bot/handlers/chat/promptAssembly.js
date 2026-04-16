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

  const messages = [
    { role: "system", content: systemPrompt },
    projectContextPolicySystemMessage,
    currentActivityPrioritySystemMessage,
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