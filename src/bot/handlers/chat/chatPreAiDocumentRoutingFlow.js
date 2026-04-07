// src/bot/handlers/chat/chatPreAiDocumentRoutingFlow.js

import { tryHandleDocumentPartRequest } from "./chatDocumentPartFlow.js";
import { tryHandleDocumentPartSummaryRequest } from "./chatDocumentPartSummaryFlow.js";
import { tryHandleActiveEstimateFollowUp } from "./chatEstimateFollowupFlow.js";
import { tryHandleDocumentChatEstimate } from "./chatDocumentEstimateFlow.js";
import { tryHandleRecentExport } from "./chatRecentExportFlow.js";

export async function runChatPreAiDocumentRouting({
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
  const documentPartSummaryResult = await tryHandleDocumentPartSummaryRequest({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
  });

  if (documentPartSummaryResult?.handled) {
    return { handled: true };
  }

  const documentPartRequestResult = await tryHandleDocumentPartRequest({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
  });

  if (documentPartRequestResult?.handled) {
    return { handled: true };
  }

  const exportResult = await tryHandleRecentExport({
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
    FileIntake,
  });

  if (exportResult?.handled) {
    return { handled: true };
  }

  const activeEstimateFollowUpResult = await tryHandleActiveEstimateFollowUp({
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
  });

  if (activeEstimateFollowUpResult?.handled) {
    return { handled: true };
  }

  const estimateResult = await tryHandleDocumentChatEstimate({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
  });

  if (estimateResult?.handled) {
    return { handled: true };
  }

  return { handled: false };
}

export default {
  runChatPreAiDocumentRouting,
};
