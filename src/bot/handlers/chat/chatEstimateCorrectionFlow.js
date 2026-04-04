// src/bot/handlers/chat/chatEstimateCorrectionFlow.js

import { resolveDocumentEstimateCorrection } from "./documentEstimateCorrectionResolver.js";
import { resolveRecentDocumentEstimateCandidate } from "./documentEstimateBridge.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";
import {
  buildEstimateReplyText,
  saveSuccessfulEstimateContext,
} from "./chatEstimateReplies.js";

export async function tryHandleEstimateCorrection({
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

  const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
  if (!activeEstimate?.estimate?.ok) {
    return { handled: false };
  }

  const recentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  if (!recentEstimateCandidate?.ok) {
    return { handled: false };
  }

  const resolved = await resolveDocumentEstimateCorrection({
    callAI,
    userText,
    currentEstimateFileName: activeEstimate?.estimate?.fileName || "",
    recentDocumentFileName: recentEstimateCandidate?.fileName || "",
    hasActiveEstimate: true,
    hasRecentDocumentCandidate: true,
  });

  if (!resolved?.isEstimateCorrection) {
    return { handled: false };
  }

  if (resolved?.needsClarification) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Уточни, какой именно недавний документ нужно взять для оценки?";
    await saveAssistantEarlyReturn(
      question,
      "document_estimate_correction_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  if (!resolved?.shouldRebindToRecentDocument) {
    return { handled: false };
  }

  saveSuccessfulEstimateContext({
    chatId: msg?.chat?.id ?? null,
    estimate: recentEstimateCandidate,
    chatIdStr,
    messageId,
    reason: "document_estimate_rebound_to_recent_document",
  });

  const text = buildEstimateReplyText(recentEstimateCandidate);
  await saveAssistantEarlyReturn(text, "document_chat_estimate_rebound");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    estimateSource: recentEstimateCandidate?.source || "unknown",
  };
}

export default {
  tryHandleEstimateCorrection,
};