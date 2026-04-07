// src/bot/handlers/chat/chatPendingClarificationExportFlow.js

import {
  savePendingClarification,
  clearPendingClarification,
} from "./clarificationSessionCache.js";
import {
  resolveExportSourceClarification,
  resolveDocumentExportTargetClarification,
} from "./exportClarificationResolver.js";
import {
  getExplicitExportCandidate,
  getRecentDocumentExportCandidate,
  getRecentAssistantReplyExportCandidate,
  getDocumentExportTargetCandidate,
} from "./outputSessionCache.js";
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

export async function continueExportPendingClarificationIfAny({
  pending,
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
}) {
  if (!pending) return { handled: false };

  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

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
  continueExportPendingClarificationIfAny,
};
