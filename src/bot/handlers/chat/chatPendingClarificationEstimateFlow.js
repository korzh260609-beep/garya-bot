// src/bot/handlers/chat/chatPendingClarificationEstimateFlow.js

import {
  savePendingClarification,
  clearPendingClarification,
} from "./clarificationSessionCache.js";
import { resolveRecentDocumentEstimateCandidate } from "./documentEstimateBridge.js";
import { resolveDocumentEstimateClarification } from "./documentEstimateClarificationResolver.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";
import {
  buildEstimateReplyTextByFocus,
  buildEstimateFollowUpReplyText,
  saveSuccessfulEstimateContext,
} from "./chatEstimateReplies.js";

export async function continueEstimatePendingClarificationIfAny({
  pending,
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
  FileIntake,
  chatIdStr,
  messageId,
}) {
  if (!pending) return { handled: false };

  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  if (pending.kind === "document_estimate_followup_detail") {
    const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);

    if (!activeEstimate?.estimate?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const resolved = await resolveDocumentEstimateClarification({
      callAI,
      userText,
      hasRecentDocument: true,
      hasRecentDocumentCandidate: true,
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        safeText(pending?.question) ||
        "Уточни, что именно посчитать по последнему документу?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_estimate_followup_detail",
        question,
        payload: pending?.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_estimate_followup_detail_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    if (!resolved?.resolved || !resolved?.refersToRecentDocument) {
      clearPendingClarification(msg?.chat?.id ?? null);
      const text =
        "Не смог понять, относится ли это уточнение к последнему документу.";
      await saveAssistantEarlyReturn(
        text,
        "document_estimate_followup_detail_unresolved"
      );
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    const requestedFocus =
      safeText(pending?.payload?.requestedFocus).toLowerCase() ||
      "general_estimate";

    const text = buildEstimateFollowUpReplyText(activeEstimate, requestedFocus);

    if (!text) {
      return { handled: false };
    }

    await saveAssistantEarlyReturn(text, "document_estimate_followup_detail");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  if (pending.kind === "document_estimate_source") {
    const recentRuntimeDocument =
      typeof FileIntake?.getRecentDocumentSessionCache === "function"
        ? FileIntake.getRecentDocumentSessionCache(msg?.chat?.id ?? null)
        : null;

    const recentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    const resolved = await resolveDocumentEstimateClarification({
      callAI,
      userText,
      hasRecentDocument: Boolean(recentRuntimeDocument),
      hasRecentDocumentCandidate: Boolean(recentEstimateCandidate?.ok),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни, о каком недавнем документе идёт речь?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_estimate_source",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_estimate_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    if (!resolved?.resolved || !resolved?.refersToRecentDocument) {
      const text =
        "Не смог понять, о каком документе идёт речь для оценки разбиения.";
      await saveAssistantEarlyReturn(text, "document_estimate_unresolved");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const estimate = resolveRecentDocumentEstimateCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    if (!estimate?.ok) {
      const text =
        "Не вижу недавний документ, для которого можно оценить разбиение.";
      await saveAssistantEarlyReturn(
        text,
        "document_estimate_no_recent_document"
      );
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    saveSuccessfulEstimateContext({
      chatId: msg?.chat?.id ?? null,
      estimate,
      chatIdStr,
      messageId,
      reason: "document_estimate_clarification_resolved",
    });

    const text = buildEstimateReplyTextByFocus(estimate, userText);
    await saveAssistantEarlyReturn(text, "document_chat_estimate");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  return { handled: false };
}

export default {
  continueEstimatePendingClarificationIfAny,
};
