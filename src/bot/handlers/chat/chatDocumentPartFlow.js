// src/bot/handlers/chat/chatDocumentPartFlow.js

import { resolveDocumentPartRequest } from "./documentPartRequestResolver.js";
import { resolveRecentDocumentPartsCandidate } from "./documentEstimateBridge.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { saveRecentDocumentCurrentPartForExport } from "./outputSessionCache.js";
import { safeText, normalizeFileBaseName } from "./chatShared.js";
import {
  buildRequestedDocumentPartReply,
  buildInvalidRequestedPartReply,
} from "./chatDocumentPartReplies.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";

export async function tryHandleDocumentPartRequest({
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

  const resolved = await resolveDocumentPartRequest({
    callAI,
    userText,
    estimateContext: activeEstimate,
  });

  if (!resolved?.isDocumentPartRequest) {
    return { handled: false };
  }

  if (resolved?.needsClarification || !resolved?.requestedPartNumber) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Какую именно часть документа показать?";
    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_part_request",
      question,
      payload: {},
    });
    await saveAssistantEarlyReturn(
      question,
      "document_part_request_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const resolvedParts = resolveRecentDocumentPartsCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  if (!resolvedParts?.ok) {
    const text = "Не вижу активный документ, из которого можно показать часть.";
    await saveAssistantEarlyReturn(text, "document_part_request_no_document");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const requestedPartNumber = Number(resolved?.requestedPartNumber || 0);
  const replyText = buildRequestedDocumentPartReply({
    resolvedParts,
    requestedPartNumber,
  });

  if (!replyText) {
    const text = buildInvalidRequestedPartReply({
      resolvedParts,
      requestedPartNumber,
    });
    await saveAssistantEarlyReturn(text, "document_part_request_invalid_part");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  saveRecentDocumentCurrentPartForExport({
    chatId,
    text: replyText,
    baseName: `${normalizeFileBaseName(
      resolvedParts?.fileName || "document"
    )}_part_${requestedPartNumber}`,
    meta: {
      source: "document_requested_part",
      fileName: resolvedParts?.fileName || null,
      partNumber: requestedPartNumber,
      chunkCount: resolvedParts?.chunkCount || 0,
      chatIdStr,
      messageId,
    },
  });

  saveDocumentExportTargetContext({
    chatId: msg?.chat?.id ?? null,
    target: "current_part",
    chatIdStr,
    messageId,
    reason: "document_requested_part",
  });

  saveExportSourceContext({
    chatId: msg?.chat?.id ?? null,
    sourceKind: "document",
    chatIdStr,
    messageId,
    reason: "document_requested_part",
  });

  await saveAssistantEarlyReturn(replyText, "document_part_request");
  await bot.sendMessage(chatId, replyText);
  return {
    handled: true,
    requestedPartNumber,
  };
}

export default {
  tryHandleDocumentPartRequest,
};