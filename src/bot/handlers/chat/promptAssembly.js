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

  const messages = [
    { role: "system", content: systemPrompt },
    projectContextPolicySystemMessage,
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