// src/bot/handlers/chat/chatDocumentEstimateFlow.js

import { resolveDocumentChatEstimateIntent } from "./documentChatEstimateResolver.js";
import { resolveRecentDocumentEstimateCandidate } from "./documentEstimateBridge.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import { safeText } from "./chatShared.js";
import {
  buildEstimateReplyText,
  saveSuccessfulEstimateContext,
} from "./chatEstimateReplies.js";

export async function tryHandleDocumentChatEstimate({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const currentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  const estimateIntent = await resolveDocumentChatEstimateIntent({
    callAI,
    userText,
    hasRecentDocument: Boolean(currentEstimateCandidate?.ok),
  });

  if (!estimateIntent?.isEstimateIntent) {
    return { handled: false };
  }

  if (!currentEstimateCandidate?.ok) {
    const question = "О каком недавнем документе идёт речь?";
    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_estimate_source",
      question,
      payload: {},
    });
    await saveAssistantEarlyReturn(question, "document_estimate_clarification");
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  saveSuccessfulEstimateContext({
    chatId: msg?.chat?.id ?? null,
    estimate: currentEstimateCandidate,
    chatIdStr,
    messageId,
    reason: "document_chat_estimate_direct",
  });

  const text = buildEstimateReplyText(currentEstimateCandidate);

  await saveAssistantEarlyReturn(text, "document_chat_estimate");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    estimateSource: currentEstimateCandidate?.source || "unknown",
  };
}

export default {
  tryHandleDocumentChatEstimate,
};