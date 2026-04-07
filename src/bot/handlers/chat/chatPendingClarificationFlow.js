// src/bot/handlers/chat/chatPendingClarificationFlow.js

import { getPendingClarification } from "./clarificationSessionCache.js";
import { continueDocumentPendingClarificationIfAny } from "./chatPendingClarificationDocumentFlow.js";
import { continueEstimatePendingClarificationIfAny } from "./chatPendingClarificationEstimateFlow.js";
import { continueExportPendingClarificationIfAny } from "./chatPendingClarificationExportFlow.js";
import { safeText } from "./chatShared.js";

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

  const documentResult = await continueDocumentPendingClarificationIfAny({
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
  });

  if (documentResult?.handled) {
    return documentResult;
  }

  const estimateResult = await continueEstimatePendingClarificationIfAny({
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
  });

  if (estimateResult?.handled) {
    return estimateResult;
  }

  const exportResult = await continueExportPendingClarificationIfAny({
    pending,
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
  });

  if (exportResult?.handled) {
    return exportResult;
  }

  return { handled: false };
}

export default {
  continuePendingClarificationIfAny,
};
