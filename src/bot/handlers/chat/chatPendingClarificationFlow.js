// src/bot/handlers/chat/chatPendingClarificationFlow.js

import {
  savePendingClarification,
  getPendingClarification,
  clearPendingClarification,
} from "./clarificationSessionCache.js";
import {
  resolveExportSourceClarification,
  resolveDocumentExportTargetClarification,
} from "./exportClarificationResolver.js";
import {
  resolveRecentDocumentEstimateCandidate,
  resolveRecentDocumentPartsCandidate,
} from "./documentEstimateBridge.js";
import { resolveDocumentEstimateClarification } from "./documentEstimateClarificationResolver.js";
import { resolveDocumentPartRequest } from "./documentPartRequestResolver.js";
import { resolveDocumentPartSummaryRequest } from "./documentPartSummaryResolver.js";
import { getActiveEstimateContext } from "./activeEstimateContextCache.js";
import {
  saveRecentDocumentCurrentPartForExport,
  getExplicitExportCandidate,
  getRecentDocumentExportCandidate,
  getRecentAssistantReplyExportCandidate,
  getDocumentExportTargetCandidate,
} from "./outputSessionCache.js";
import {
  safeText,
  normalizeFileBaseName,
  normalizeRequestedOutputFormat,
  normalizePreferredExportKind,
  normalizeDocumentExportTarget,
  isDocumentRelatedSourceKind,
} from "./chatShared.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";
import {
  buildCreatedExportFile,
  sendCreatedExportFile,
} from "./chatExportFlow.js";
import {
  buildEstimateReplyText,
  buildEstimateFollowUpReplyText,
  saveSuccessfulEstimateContext,
} from "./chatEstimateReplies.js";
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

export async function continuePendingClarificationIfAny({
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
  const pending = getPendingClarification(msg?.chat?.id ?? null);
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

    const text = buildEstimateReplyText(estimate);
    await saveAssistantEarlyReturn(text, "document_chat_estimate");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  if (pending.kind === "export_source") {
    const recentDocument = getRecentDocumentExportCandidate(msg?.chat?.id ?? null);
    const recentAssistantReply = getRecentAssistantReplyExportCandidate(
      msg?.chat?.id ?? null
    );

    const resolved = await resolveExportSourceClarification({
      callAI,
      userText,
      hasRecentDocument: Boolean(recentDocument),
      hasRecentAssistantReply: Boolean(recentAssistantReply),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни: сохранить ответ или документ?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "export_source",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(question, "export_clarification_repeat");
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    const explicitKind = normalizePreferredExportKind(resolved?.sourceKind);
    const requestedFormat = normalizeRequestedOutputFormat(
      pending?.payload?.requestedFormat || "txt"
    );

    let recentExportCandidate = null;

    if (isDocumentRelatedSourceKind(explicitKind)) {
      saveExportSourceContext({
        chatId: msg?.chat?.id ?? null,
        sourceKind: "document",
        chatIdStr,
        messageId,
        reason: "export_source_clarification_document",
      });

      const exportTarget = pending?.payload?.documentTarget || "auto";

      const normalizedDocumentTarget = normalizeDocumentExportTarget(exportTarget);
      if (normalizedDocumentTarget) {
        saveDocumentExportTargetContext({
          chatId: msg?.chat?.id ?? null,
          target: normalizedDocumentTarget,
          chatIdStr,
          messageId,
          reason: "export_source_clarification_payload_target",
        });
      }

      recentExportCandidate = getDocumentExportTargetCandidate(
        msg?.chat?.id ?? null,
        exportTarget
      );
    } else {
      if (explicitKind === "assistant_reply") {
        saveExportSourceContext({
          chatId: msg?.chat?.id ?? null,
          sourceKind: "assistant_reply",
          chatIdStr,
          messageId,
          reason: "export_source_clarification_assistant_reply",
        });
      }

      recentExportCandidate = getExplicitExportCandidate(
        msg?.chat?.id ?? null,
        explicitKind
      );
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    if (!recentExportCandidate) {
      const text =
        explicitKind === "document"
          ? "Не вижу подходящий недавний контент документа для экспорта."
          : "Не вижу недавний ответ SG для экспорта.";
      await saveAssistantEarlyReturn(text, "export_no_recent_session");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const created = buildCreatedExportFile({
      recentExportCandidate,
      requestedFormat,
    });

    const sent = await sendCreatedExportFile({
      bot,
      chatId,
      created,
      saveAssistantEarlyReturn,
    });

    return { handled: true, ok: sent?.ok === true };
  }

  if (pending.kind === "document_export_target") {
    const resolved = await resolveDocumentExportTargetClarification({
      callAI,
      userText,
      hasSummaryCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "summary")
      ),
      hasFullTextCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "full_text")
      ),
      hasCurrentPartCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "current_part")
      ),
      hasAssistantAnswerCandidate: Boolean(
        getDocumentExportTargetCandidate(
          msg?.chat?.id ?? null,
          "assistant_answer_about_document"
        )
      ),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни: нужен summary, полный текст, текущая часть или мой ответ про документ?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_export_target",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_export_target_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    const target = safeText(resolved?.target).toLowerCase() || "auto";
    const requestedFormat = normalizeRequestedOutputFormat(
      pending?.payload?.requestedFormat || "txt"
    );

    const normalizedDocumentTarget = normalizeDocumentExportTarget(target);
    if (normalizedDocumentTarget) {
      saveDocumentExportTargetContext({
        chatId: msg?.chat?.id ?? null,
        target: normalizedDocumentTarget,
        chatIdStr,
        messageId,
        reason: "document_export_target_clarification_resolved",
      });
    }

    saveExportSourceContext({
      chatId: msg?.chat?.id ?? null,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_export_target_clarification_resolved",
    });

    clearPendingClarification(msg?.chat?.id ?? null);

    const recentExportCandidate = getDocumentExportTargetCandidate(
      msg?.chat?.id ?? null,
      target
    );

    if (!recentExportCandidate) {
      const text = "Не вижу подходящий недавний контент документа для экспорта.";
      await saveAssistantEarlyReturn(text, "export_no_recent_session");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const created = buildCreatedExportFile({
      recentExportCandidate,
      requestedFormat,
    });

    const sent = await sendCreatedExportFile({
      bot,
      chatId,
      created,
      saveAssistantEarlyReturn,
    });

    return { handled: true, ok: sent?.ok === true };
  }

  return { handled: false };
}

export default {
  continuePendingClarificationIfAny,
};