// src/bot/handlers/chat/chatDocumentPartSummaryArtifacts.js

import { saveRecentAssistantAnswerAboutDocumentForExport } from "./outputSessionCache.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
} from "./chatContextCacheHelpers.js";
import {
  safeText,
  normalizeFileBaseName,
} from "./chatShared.js";

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

export default {
  saveDocumentPartSummaryArtifacts,
};
