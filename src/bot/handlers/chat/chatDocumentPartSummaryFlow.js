// src/bot/handlers/chat/chatDocumentPartSummaryFlow.js

import { savePendingClarification } from "./clarificationSessionCache.js";
import { resolveRecentDocumentPartsCandidate } from "./documentEstimateBridge.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import { resolveDocumentPartSummaryRequest } from "./documentPartSummaryResolver.js";
import {
  saveRecentAssistantAnswerAboutDocumentForExport,
} from "./outputSessionCache.js";
import {
  safeText,
  normalizeFileBaseName,
} from "./chatShared.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";

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

export async function buildDocumentPartSummaryReply({
  callAI,
  userText,
  fileName,
  requestedPartNumber,
  chunkCount,
  partText,
}) {
  if (typeof callAI !== "function") return "";
  const normalizedPartText = safeText(partText).trim();
  if (!normalizedPartText) return "";

  const messages = [
    {
      role: "system",
      content:
        "You are a precise assistant that summarizes one specific document part.\n" +
        "Your task: produce a SHORT concise summary of the requested part only.\n" +
        "Rules:\n" +
        "- Use the same language as the user's request.\n" +
        "- Summarize the meaning, not the whole document.\n" +
        "- Do NOT dump the raw text.\n" +
        "- Do NOT talk about number of parts or estimate.\n" +
        "- Focus only on the requested part.\n" +
        "- Keep it brief and clear: 2-5 short sentences.\n" +
        "- If the text is legal/technical, explain simply but accurately.\n" +
        "- No markdown tables. No JSON.",
    },
    {
      role: "user",
      content:
        `User request:\n${safeText(userText).trim()}\n\n` +
        `Document: ${safeText(fileName).trim() || "document"}\n` +
        `Requested part: ${Number(requestedPartNumber || 0)} of ${Number(chunkCount || 0)}\n\n` +
        `Part text:\n${normalizedPartText}`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 260,
      temperature: 0.2,
    });

    return safeText(raw).trim();
  } catch {
    return "";
  }
}

export function saveDocumentPartSummaryArtifacts({
  chatId,
  replyText,
  fileName,
  requestedPartNumber,
  chunkCount,
  chatIdStr,
  messageId,
}) {
  if (!safeText(replyText).trim()) return null;

  saveRecentAssistantAnswerAboutDocumentForExport({
    chatId,
    text: replyText,
    baseName: `${normalizeFileBaseName(fileName || "document")}_part_${requestedPartNumber}_summary`,
    meta: {
      source: "assistant_answer_about_document_part",
      fileName: fileName || null,
      partNumber: requestedPartNumber,
      chunkCount: chunkCount || 0,
      chatIdStr,
      messageId,
    },
  });

  saveDocumentExportTargetContext({
    chatId,
    target: "assistant_answer_about_document",
    chatIdStr,
    messageId,
    reason: "assistant_answer_about_document_part",
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "document",
    chatIdStr,
    messageId,
    reason: "assistant_answer_about_document_part",
  });

  return true;
}

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

export default {
  tryHandleDocumentPartSummaryRequest,
  buildDocumentPartSummaryReply,
  saveDocumentPartSummaryArtifacts,
};