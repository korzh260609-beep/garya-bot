// src/bot/handlers/chat/chatDocumentPartSummaryFlow.js

import { savePendingClarification } from "./clarificationSessionCache.js";
import { resolveRecentDocumentPartsCandidate } from "./documentEstimateBridge.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { resolveDocumentPartSummaryRequest } from "./documentPartSummaryResolver.js";
import { safeText } from "./chatShared.js";
import {
  buildInvalidRequestedPartSummaryReply,
  buildDocumentPartSummaryReply,
} from "./chatDocumentPartSummaryText.js";
import { saveDocumentPartSummaryArtifacts } from "./chatDocumentPartSummaryArtifacts.js";

export async function tryHandleDocumentPartSummaryRequest({
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

  const resolvedParts = resolveRecentDocumentPartsCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  if (!resolvedParts?.ok) {
    return { handled: false };
  }

  const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
  const estimateContext =
    activeEstimate?.estimate?.ok
      ? activeEstimate
      : { estimate: resolvedParts?.estimate || null };

  if (!estimateContext?.estimate?.ok) {
    return { handled: false };
  }

  const resolved = await resolveDocumentPartSummaryRequest({
    callAI,
    userText,
    estimateContext,
  });

  if (!resolved?.isDocumentPartSummaryRequest) {
    return { handled: false };
  }

  if (resolved?.needsClarification || !resolved?.requestedPartNumber) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Какую именно часть документа кратко описать?";
    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_part_summary_request",
      question,
      payload: {},
    });
    await saveAssistantEarlyReturn(
      question,
      "document_part_summary_request_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const requestedPartNumber = Number(resolved?.requestedPartNumber || 0);
  const chunks = Array.isArray(resolvedParts?.chunks) ? resolvedParts.chunks : [];
  const targetIndex = requestedPartNumber - 1;

  if (
    !Number.isFinite(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= chunks.length
  ) {
    const text = buildInvalidRequestedPartSummaryReply({
      resolvedParts,
      requestedPartNumber,
    });
    await saveAssistantEarlyReturn(
      text,
      "document_part_summary_request_invalid_part"
    );
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const replyText = await buildDocumentPartSummaryReply({
    callAI,
    userText,
    fileName: resolvedParts?.fileName || "document",
    requestedPartNumber,
    chunkCount: resolvedParts?.chunkCount || 0,
    partText: chunks[targetIndex],
  });

  if (!replyText) {
    const text = "Не смог кратко описать эту часть документа.";
    await saveAssistantEarlyReturn(
      text,
      "document_part_summary_request_failed"
    );
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  saveDocumentPartSummaryArtifacts({
    chatId,
    replyText,
    fileName: resolvedParts?.fileName || "document",
    requestedPartNumber,
    chunkCount: resolvedParts?.chunkCount || 0,
    chatIdStr,
    messageId,
  });

  await saveAssistantEarlyReturn(replyText, "document_part_summary_request");
  await bot.sendMessage(chatId, replyText);

  return {
    handled: true,
    requestedPartNumber,
  };
}

export {
  buildInvalidRequestedPartSummaryReply,
  buildDocumentPartSummaryReply,
  saveDocumentPartSummaryArtifacts,
};

export default {
  tryHandleDocumentPartSummaryRequest,
  buildInvalidRequestedPartSummaryReply,
  buildDocumentPartSummaryReply,
  saveDocumentPartSummaryArtifacts,
};
