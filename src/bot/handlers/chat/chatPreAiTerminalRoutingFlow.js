// src/bot/handlers/chat/chatPreAiTerminalRoutingFlow.js

import { resolveFileIntakeDecision } from "./fileIntakeDecision.js";
import {
  handleDirectReplyEarlyReturn,
  handleNoAiEarlyReturn,
} from "./chatEarlyReturnFlow.js";

export async function runChatPreAiTerminalRouting({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  telegramBotToken = "",
  callAI,
  saveAssistantEarlyReturn,
  chatIdStr,
  messageId,
}) {
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
  runChatPreAiTerminalRouting,
};
