// src/bot/handlers/chat/chatPostAiPersistenceFlow.js

import {
  saveRecentAssistantReplyForExport,
  saveRecentDocumentForExport,
  saveRecentDocumentSummaryForExport,
  saveRecentDocumentCurrentPartForExport,
  saveRecentAssistantAnswerAboutDocumentForExport,
} from "./outputSessionCache.js";
import { saveActiveDocumentContext } from "./activeDocumentContextCache.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";

export function handlePostAiExportPersistence({
  chatId,
  aiReply,
  answerMode,
  mediaResponseMode,
  chatIdStr,
  messageId,
  FileIntake,
  effective,
}) {
  saveRecentAssistantReplyForExport({
    chatId,
    text: aiReply,
    baseName: "assistant_reply",
    meta: {
      source: "ai_reply",
      chatIdStr,
      messageId,
      answerMode,
      mediaResponseMode: mediaResponseMode || null,
    },
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "assistant_reply",
    chatIdStr,
    messageId,
    reason:
      mediaResponseMode && mediaResponseMode.startsWith("document_")
        ? "document_mode_assistant_reply_saved"
        : "ai_reply",
  });

  if (mediaResponseMode === "document_summary_answer") {
    saveRecentDocumentSummaryForExport({
      chatId,
      text: aiReply,
      baseName: "document_summary",
      meta: {
        source: "document_summary_answer",
        chatIdStr,
        messageId,
      },
    });

    saveRecentAssistantAnswerAboutDocumentForExport({
      chatId,
      text: aiReply,
      baseName: "document_answer",
      meta: {
        source: "assistant_answer_about_document",
        chatIdStr,
        messageId,
      },
    });

    saveDocumentExportTargetContext({
      chatId,
      target: "summary",
      chatIdStr,
      messageId,
      reason: "document_summary_answer",
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_summary_answer",
    });
  }

  if (mediaResponseMode === "document_full_text_answer") {
    saveRecentDocumentCurrentPartForExport({
      chatId,
      text: aiReply,
      baseName: "document_part",
      meta: {
        source: "document_current_part",
        chatIdStr,
        messageId,
      },
    });

    saveDocumentExportTargetContext({
      chatId,
      target: "current_part",
      chatIdStr,
      messageId,
      reason: "document_full_text_answer",
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_full_text_answer",
    });
  }

  if (mediaResponseMode && mediaResponseMode.startsWith("document_")) {
    const recentRuntimeDocument =
      typeof FileIntake?.getRecentDocumentSessionCache === "function"
        ? FileIntake.getRecentDocumentSessionCache(chatId)
        : null;

    const rawDocumentText = recentRuntimeDocument?.text || effective;
    const rawDocumentFileName =
      recentRuntimeDocument?.fileName ||
      recentRuntimeDocument?.title ||
      "document_context";

    saveRecentDocumentForExport({
      chatId,
      text: rawDocumentText,
      baseName: rawDocumentFileName,
      meta: {
        source: recentRuntimeDocument?.text
          ? "document_runtime_text"
          : "document_effective_context",
        fileName: recentRuntimeDocument?.fileName || null,
        title: recentRuntimeDocument?.title || null,
        chatIdStr,
        messageId,
      },
    });

    saveActiveDocumentContext({
      chatId,
      fileName: recentRuntimeDocument?.fileName || "",
      title: recentRuntimeDocument?.title || "",
      text: rawDocumentText,
      source: recentRuntimeDocument?.text
        ? "document_runtime_text"
        : "document_effective_context",
      meta: {
        chatIdStr,
        messageId,
      },
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_context_active",
    });
  }
}

export default {
  handlePostAiExportPersistence,
};