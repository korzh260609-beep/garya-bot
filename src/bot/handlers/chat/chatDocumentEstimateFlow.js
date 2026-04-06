// src/bot/handlers/chat/chatDocumentEstimateFlow.js

import { resolveDocumentChatEstimateIntent } from "./documentChatEstimateResolver.js";
import { resolveRecentDocumentEstimateCandidate } from "./documentEstimateBridge.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import { safeText } from "./chatShared.js";
import {
  buildEstimateReplyTextByFocus,
  saveSuccessfulEstimateContext,
} from "./chatEstimateReplies.js";

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

function looksLikeExplicitFileExportRequest(userText) {
  const normalized = normalizeSemanticText(userText);
  if (!normalized) return false;

  const mentionsFormat = hasAnyStem(normalized, [
    " txt",
    "txt ",
    " pdf",
    "pdf ",
    " docx",
    "docx ",
    " md",
    "md ",
    "markdown",
    "в формате",
    "format",
  ]);

  const mentionsFileTarget = hasAnyStem(normalized, [
    "файл",
    "файлом",
    "документом",
    "документ",
    "document",
  ]);

  const exportMeaning = hasAnyStem(normalized, [
    "экспорт",
    "сохран",
    "скача",
    "выгруз",
    "отправ",
    "пришли",
    "вышли",
    "выдай",
    "отдай",
    "сделай файл",
    "сделай txt",
    "сделай pdf",
    "переделай",
    "преобраз",
    "конверт",
    "convert",
    "export",
  ]);

  const wholeDocumentMeaning = hasAnyStem(normalized, [
    "весь файл",
    "весь документ",
    "полный файл",
    "полный документ",
    "целиком файл",
    "целиком документ",
    "whole file",
    "full document",
  ]);

  if ((mentionsFormat || mentionsFileTarget) && exportMeaning) {
    return true;
  }

  if (wholeDocumentMeaning && mentionsFormat) {
    return true;
  }

  return false;
}

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

  // Hard local guard:
  // explicit file conversion/export request must NEVER fall into estimate.
  if (looksLikeExplicitFileExportRequest(userText)) {
    return { handled: false };
  }

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

  const text = buildEstimateReplyTextByFocus(currentEstimateCandidate, userText);

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