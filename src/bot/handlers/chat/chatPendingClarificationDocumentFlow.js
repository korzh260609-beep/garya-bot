// src/bot/handlers/chat/chatPendingClarificationDocumentFlow.js

import {
  savePendingClarification,
  clearPendingClarification,
} from "./clarificationSessionCache.js";
import { resolveRecentDocumentPartsCandidate } from "./documentEstimateBridge.js";
import { resolveDocumentPartRequest } from "./documentPartRequestResolver.js";
import { resolveDocumentPartSummaryRequest } from "./documentPartSummaryResolver.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import {
  saveRecentDocumentCurrentPartForExport,
} from "./outputSessionCache.js";
import {
  safeText,
  normalizeFileBaseName,
} from "./chatShared.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";
import {
  buildRequestedDocumentPartReply,
  buildInvalidRequestedPartReply,
} from "./chatDocumentPartReplies.js";
import {
  buildDocumentPartSummaryReply,
  saveDocumentPartSummaryArtifacts,
} from "./chatDocumentPartSummaryFlow.js";

function buildInvalidRequestedPartSummaryReply({
  resolvedParts,
  requestedPartNumber,
}) {
  const chunkCount = Number(resolvedParts?.chunkCount || 0);
  const fileName = safeText(resolvedParts?.fileName || "document");
  const requested = Number(requestedPartNumber || 0);

  if (chunkCount <= 0) {
    return `Не вижу частей для ${fileName}.`;
  }

  if (requested <= 0) {
    return `Не понял номер части. Укажи номер от 1 до ${chunkCount}.`;
  }

  if (chunkCount === 1) {
    return `${fileName} помещается в 1 часть. Укажи часть 1.`;
  }

  return `В ${fileName} только ${chunkCount} частей. Укажи номер от 1 до ${chunkCount}.`;
}

export async function continueDocumentPendingClarificationIfAny({
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

  if (pending.kind === "document_part_request") {
    const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);

    if (!activeEstimate?.estimate?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const resolved = await resolveDocumentPartRequest({
      callAI,
      userText,
      estimateContext: activeEstimate,
    });

    if (resolved?.needsClarification || !resolved?.requestedPartNumber) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        safeText(pending?.question) ||
        "Какую именно часть документа показать?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_part_request",
        question,
        payload: pending?.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_part_request_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

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
    return { handled: true };
  }

  if (pending.kind === "document_part_summary_request") {
    const resolvedParts = resolveRecentDocumentPartsCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    if (!resolvedParts?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
    const estimateContext =
      activeEstimate?.estimate?.ok
        ? activeEstimate
        : { estimate: resolvedParts?.estimate || null };

    if (!estimateContext?.estimate?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const resolved = await resolveDocumentPartSummaryRequest({
      callAI,
      userText,
      estimateContext,
    });

    if (resolved?.needsClarification || !resolved?.requestedPartNumber) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        safeText(pending?.question) ||
        "Какую именно часть документа кратко описать?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_part_summary_request",
        question,
        payload: pending?.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_part_summary_request_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

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
    return { handled: true };
  }

  return { handled: false };
}

export default {
  continueDocumentPendingClarificationIfAny,
};
