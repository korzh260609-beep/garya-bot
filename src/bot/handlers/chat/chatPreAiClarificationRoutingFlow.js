// src/bot/handlers/chat/chatPreAiClarificationRoutingFlow.js

import { continuePendingClarificationIfAny } from "./chatPendingClarificationFlow.js";
import { tryHandleEstimateCorrection } from "./chatEstimateCorrectionFlow.js";

export async function runChatPreAiClarificationRouting({
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

  return { handled: false };
}

export default {
  runChatPreAiClarificationRouting,
};
