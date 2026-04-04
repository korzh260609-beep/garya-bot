// src/bot/handlers/chat/chatPreAiRoutingFlow.js

import { resolveFileIntakeDecision } from "./fileIntakeDecision.js";
import { continuePendingClarificationIfAny } from "./chatPendingClarificationFlow.js";
import { tryHandleEstimateCorrection } from "./chatEstimateCorrectionFlow.js";
import { tryHandleDocumentPartRequest } from "./chatDocumentPartFlow.js";
import { tryHandleActiveEstimateFollowUp } from "./chatEstimateFollowupFlow.js";
import { tryHandleDocumentChatEstimate } from "./chatDocumentEstimateFlow.js";
import { tryHandleRecentExport } from "./chatRecentExportFlow.js";
import {
  handleDirectReplyEarlyReturn,
  handleNoAiEarlyReturn,
} from "./chatEarlyReturnFlow.js";

export async function runChatPreAiRouting({
  bot,
  msg,
  chatId,
  chatIdStr,
  trimmed,
  FileIntake,
  telegramBotToken = "",
  callAI,
  saveAssistantEarlyReturn,
  messageId,
}) {
  const clarificationResult = await continuePendingClarificationIfAny({
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

  if (clarificationResult?.handled) {
    return { handled: true };
  }

  const estimateCorrectionResult = await tryHandleEstimateCorrection({
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

  if (estimateCorrectionResult?.handled) {
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

  const { effective, shouldCallAI, directReplyText, mediaResponseMode } =
    await resolveFileIntakeDecision({
      FileIntake,
      msg,
      trimmed,
      telegramBotToken,
      callAI,
    });

  if (!effective && !shouldCallAI && !directReplyText) {
    const text = "Напиши текстом, что нужно сделать.";
    await saveAssistantEarlyReturn(text, "empty");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const directReplyResult = await handleDirectReplyEarlyReturn({
    bot,
    chatId,
    directReplyText,
    saveAssistantEarlyReturn,
    chatIdStr,
    messageId,
  });

  if (directReplyResult?.handled) {
    return { handled: true };
  }

  const noAiResult = await handleNoAiEarlyReturn({
    bot,
    chatId,
    shouldCallAI,
    saveAssistantEarlyReturn,
    chatIdStr,
    messageId,
  });

  if (noAiResult?.handled) {
    return { handled: true };
  }

  return {
    handled: false,
    effective,
    shouldCallAI,
    directReplyText,
    mediaResponseMode,
  };
}

export default {
  runChatPreAiRouting,
};