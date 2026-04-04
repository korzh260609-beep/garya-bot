// src/bot/handlers/chat/chatEstimateFollowupFlow.js

import { resolveDocumentEstimateFollowUp } from "./documentEstimateFollowUpResolver.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";
import { buildEstimateFollowUpReplyText } from "./chatEstimateReplies.js";

function normalizeSemanticText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyStem(text, stems = []) {
  return stems.some((stem) => text.includes(stem));
}

function extractAllNumbers(text) {
  const matches = text.match(/\d+/g);
  if (!matches) return [];
  return matches
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function hasSpecificPartReference(text) {
  const normalized = normalizeSemanticText(text);
  const numbers = extractAllNumbers(normalized);
  if (numbers.length === 0) return false;

  return hasAnyStem(normalized, [
    "част",
    "part",
    "chunk",
    "секц",
    "раздел",
    "глава",
    "пункт",
    "фрагмент",
    "кусок",
  ]);
}

function looksLikeDocumentPartSummaryIntent(text) {
  const normalized = normalizeSemanticText(text);
  if (!hasSpecificPartReference(normalized)) return false;

  const summaryMeaning = hasAnyStem(normalized, [
    "о чем",
    "про что",
    "что там",
    "что в",
    "суть",
    "кратк",
    "коротк",
    "summary",
    "summar",
    "describe",
    "description",
    "about",
    "essence",
    "объясн",
    "опис",
    "опиши",
    "поясн",
    "смысл",
  ]);

  if (!summaryMeaning) return false;

  const rawTextMeaning = hasAnyStem(normalized, [
    "покажи",
    "показ",
    "дай ",
    "скинь",
    "отправ",
    "встав",
    "вывед",
    "текст",
    "полный",
    "целиком",
    "raw",
    "exact text",
    "actual text",
    "content",
  ]);

  return !rawTextMeaning;
}

function looksLikeRawDocumentPartIntent(text) {
  const normalized = normalizeSemanticText(text);
  if (!hasSpecificPartReference(normalized)) return false;

  const rawMeaning = hasAnyStem(normalized, [
    "покажи",
    "показ",
    "дай ",
    "скинь",
    "отправ",
    "встав",
    "вывед",
    "текст",
    "полный",
    "целиком",
    "raw",
    "exact text",
    "actual text",
    "content",
    "сюда в чат",
    "в чат",
  ]);

  if (!rawMeaning) return false;

  const summaryMeaning = hasAnyStem(normalized, [
    "о чем",
    "про что",
    "суть",
    "кратк",
    "коротк",
    "summary",
    "summar",
    "describe",
    "description",
    "about",
    "essence",
    "объясн",
    "опис",
    "поясн",
    "смысл",
  ]);

  return !summaryMeaning;
}

function looksLikeTruncatedRawTextComplaint(text) {
  const normalized = normalizeSemanticText(text);

  const complaintMeaning = hasAnyStem(normalized, [
    "обрез",
    "урез",
    "усеч",
    "оборва",
    "прерва",
    "не весь",
    "не полностью",
    "не полный",
    "не допис",
    "не до конца",
    "почему кусок",
    "с середины",
    "закончился",
    "часть текста пропала",
    "text cut",
    "cut off",
    "truncat",
    "abrupt",
    "incomplete",
    "missing part",
  ]);

  if (!complaintMeaning) return false;

  const rawTextContext = hasAnyStem(normalized, [
    "текст",
    "част",
    "part",
    "chunk",
    "кусок",
    "фрагмент",
    "сообщение",
    "ответ",
    "в чат",
  ]);

  return rawTextContext;
}

function shouldBypassEstimateFollowUp(userText) {
  const normalized = normalizeSemanticText(userText);
  if (!normalized) return false;

  if (looksLikeTruncatedRawTextComplaint(normalized)) return true;
  if (looksLikeDocumentPartSummaryIntent(normalized)) return true;
  if (looksLikeRawDocumentPartIntent(normalized)) return true;

  return false;
}

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

  // Guard layer:
  // do not allow estimate follow-up to steal:
  // 1) complaint about truncated/cut raw text
  // 2) summary/description of specific part intent
  // 3) raw specific part request intent
  if (shouldBypassEstimateFollowUp(userText)) {
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