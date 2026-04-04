// src/bot/handlers/chat/chatRecentExportFlow.js

import {
  getExplicitExportCandidate,
  getRecentDocumentExportCandidate,
  getRecentAssistantReplyExportCandidate,
  getDocumentExportTargetCandidate,
} from "./outputSessionCache.js";
import { resolveExportIntent } from "./exportIntentResolver.js";
import { resolveDocumentExportTarget } from "./documentExportTargetResolver.js";
import { resolveDocumentChatEstimateIntent } from "./documentChatEstimateResolver.js";
import { resolveRecentDocumentEstimateCandidate } from "./documentEstimateBridge.js";
import { resolveDocumentFollowupIntent } from "./documentFollowupIntentResolver.js";
import { savePendingClarification } from "./clarificationSessionCache.js";
import {
  safeText,
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

export async function tryHandleRecentExport({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
  FileIntake,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const recentDocument = getRecentDocumentExportCandidate(msg?.chat?.id ?? null);
  const recentAssistantReply = getRecentAssistantReplyExportCandidate(
    msg?.chat?.id ?? null
  );

  if (recentDocument) {
    const estimateCandidate = resolveRecentDocumentEstimateCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    const estimateIntent = await resolveDocumentChatEstimateIntent({
      callAI,
      userText,
      hasRecentDocument: Boolean(estimateCandidate?.ok),
    });

    if (estimateIntent?.isEstimateIntent) {
      return { handled: false };
    }

    const documentFollowupIntent = await resolveDocumentFollowupIntent({
      callAI,
      userText,
      hasRecentDocument: true,
      hasAttachedDocument: false,
    });

    if (documentFollowupIntent?.isDocumentIntent) {
      return { handled: false };
    }
  }

  const exportIntent = await resolveExportIntent({
    callAI,
    userText,
    hasRecentDocument: Boolean(recentDocument),
    hasRecentAssistantReply: Boolean(recentAssistantReply),
  });

  if (!exportIntent?.isExportIntent) {
    return { handled: false };
  }

  if (exportIntent?.needsClarification) {
    const question =
      safeText(exportIntent?.clarificationQuestion) ||
      "Уточни: сохранить ответ или документ?";

    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "export_source",
      question,
      payload: {
        requestedFormat: normalizeRequestedOutputFormat(exportIntent?.format),
        documentTarget: "auto",
      },
    });

    await saveAssistantEarlyReturn(question, "export_clarification");
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const explicitKind = normalizePreferredExportKind(exportIntent?.sourceKind);
  const requestedFormat = normalizeRequestedOutputFormat(exportIntent?.format);

  let recentExportCandidate = null;

  if (isDocumentRelatedSourceKind(explicitKind)) {
    saveExportSourceContext({
      chatId: msg?.chat?.id ?? null,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_export_requested",
    });

    const exportTarget = await resolveDocumentExportTarget({
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

    if (exportTarget?.needsClarification) {
      const question =
        safeText(exportTarget?.clarificationQuestion) ||
        "Уточни: нужен summary, полный текст, текущая часть или мой ответ про документ?";

      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_export_target",
        question,
        payload: {
          requestedFormat,
        },
      });

      await saveAssistantEarlyReturn(
        question,
        "document_export_target_clarification"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    const normalizedDocumentTarget = normalizeDocumentExportTarget(
      exportTarget?.target || "auto"
    );
    if (normalizedDocumentTarget) {
      saveDocumentExportTargetContext({
        chatId: msg?.chat?.id ?? null,
        target: normalizedDocumentTarget,
        chatIdStr,
        messageId,
        reason: "document_export_target_resolved",
      });
    }

    recentExportCandidate = getDocumentExportTargetCandidate(
      msg?.chat?.id ?? null,
      exportTarget?.target || "auto"
    );
  } else {
    if (explicitKind === "assistant_reply" || explicitKind === "auto") {
      saveExportSourceContext({
        chatId: msg?.chat?.id ?? null,
        sourceKind: "assistant_reply",
        chatIdStr,
        messageId,
        reason:
          explicitKind === "assistant_reply"
            ? "assistant_reply_export_requested"
            : "auto_export_requested",
      });
    }

    recentExportCandidate = getExplicitExportCandidate(
      msg?.chat?.id ?? null,
      explicitKind
    );
  }

  if (!recentExportCandidate) {
    let text =
      "Не вижу недавний документ или ответ для экспорта. Сначала отправь файл или получи ответ SG.";

    if (explicitKind === "assistant_reply") {
      text = "Не вижу недавний ответ SG для экспорта.";
    } else if (explicitKind === "document") {
      text = "Не вижу подходящий недавний контент документа для экспорта.";
    }

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

  return {
    handled: true,
    ok: sent?.ok === true,
    sourceKind: recentExportCandidate?.kind || "unknown",
  };
}

export default {
  tryHandleRecentExport,
};