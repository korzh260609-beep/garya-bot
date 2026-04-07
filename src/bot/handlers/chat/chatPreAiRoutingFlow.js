// src/bot/handlers/chat/chatPreAiRoutingFlow.js

import { runChatPreAiClarificationRouting } from "./chatPreAiClarificationRoutingFlow.js";
import { runChatPreAiDocumentRouting } from "./chatPreAiDocumentRoutingFlow.js";
import { runChatPreAiTerminalRouting } from "./chatPreAiTerminalRoutingFlow.js";

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
  const clarificationResult = await runChatPreAiClarificationRouting({
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

  const documentResult = await runChatPreAiDocumentRouting({
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
    return { handled: true };
  }

  return runChatPreAiTerminalRouting({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    telegramBotToken,
    callAI,
    saveAssistantEarlyReturn,
    chatIdStr,
    messageId,
  });
}

export default {
  runChatPreAiRouting,
};
