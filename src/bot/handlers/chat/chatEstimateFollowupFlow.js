// src/bot/handlers/chat/chatEstimateFollowupFlow.js

import { resolveDocumentEstimateFollowUp } from "./documentEstimateFollowUpResolver.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";
import { buildEstimateFollowUpReplyText } from "./chatEstimateReplies.js";

export async function tryHandleActiveEstimateFollowUp({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
  if (!activeEstimate?.estimate?.ok) {
    return { handled: false };
  }

  const resolved = await resolveDocumentEstimateFollowUp({
    callAI,
    userText,
    estimateContext: activeEstimate,
  });

  if (!resolved?.isFollowUpToLastEstimate) {
    return { handled: false };
  }

  if (resolved?.needsClarification) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Уточни, что именно по последней оценке тебя интересует?";

    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_estimate_followup_detail",
      question,
      payload: {
        requestedFocus:
          safeText(resolved?.requestedFocus).toLowerCase() || "general_estimate",
      },
    });

    await saveAssistantEarlyReturn(
      question,
      "document_estimate_followup_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const text = buildEstimateFollowUpReplyText(
    activeEstimate,
    resolved?.requestedFocus || "general_estimate"
  );

  if (!text) {
    return { handled: false };
  }

  await saveAssistantEarlyReturn(text, "document_estimate_followup");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    requestedFocus: resolved?.requestedFocus || "general_estimate",
  };
}

export default {
  tryHandleActiveEstimateFollowUp,
};