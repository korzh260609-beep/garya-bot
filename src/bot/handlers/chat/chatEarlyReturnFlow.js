// src/bot/handlers/chat/chatEarlyReturnFlow.js

import { saveRecentAssistantReplyForExport } from "./outputSessionCache.js";
import { saveExportSourceContext } from "./chatContextCacheHelpers.js";

export async function handleDirectReplyEarlyReturn({
  bot,
  chatId,
  directReplyText,
  saveAssistantEarlyReturn,
  chatIdStr,
  messageId,
}) {
  if (!directReplyText) {
    return { handled: false };
  }

  await saveAssistantEarlyReturn(directReplyText, "direct");
  await bot.sendMessage(chatId, directReplyText);

  saveRecentAssistantReplyForExport({
    chatId,
    text: directReplyText,
    baseName: "assistant_reply",
    meta: {
      source: "direct_reply",
      chatIdStr,
      messageId,
    },
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "assistant_reply",
    chatIdStr,
    messageId,
    reason: "direct_reply",
  });

  return { handled: true };
}

export async function handleNoAiEarlyReturn({
  bot,
  chatId,
  shouldCallAI,
  saveAssistantEarlyReturn,
  chatIdStr,
  messageId,
}) {
  if (shouldCallAI) {
    return { handled: false };
  }

  const text = "Напиши текстом, что нужно сделать.";
  await saveAssistantEarlyReturn(text, "no_ai");
  await bot.sendMessage(chatId, text);

  saveRecentAssistantReplyForExport({
    chatId,
    text,
    baseName: "assistant_reply",
    meta: {
      source: "no_ai_fallback",
      chatIdStr,
      messageId,
    },
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "assistant_reply",
    chatIdStr,
    messageId,
    reason: "no_ai_fallback",
  });

  return { handled: true };
}

export default {
  handleDirectReplyEarlyReturn,
  handleNoAiEarlyReturn,
};