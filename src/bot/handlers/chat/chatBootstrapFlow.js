// src/bot/handlers/chat/chatBootstrapFlow.js

import { getMemoryService } from "../../../core/memoryServiceFactory.js";
import { createChatMemoryBridge } from "./memoryBridge.js";
import { createAssistantReplyPersistence } from "./assistantReplyPersistence.js";
import { hydrateRecentRuntimeDocumentIntoCaches } from "./chatContextCacheHelpers.js";

export function bootstrapChatHandler({
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  globalUserId = null,
  saveMessageToMemory,
  saveChatPair,
  isMonarch,
  FileIntake,
}) {
  const messageId = msg.message_id ?? null;

  const monarchNow =
    typeof isMonarch === "function" ? isMonarch(senderIdStr) : false;

  const { memory, memoryWrite } = createChatMemoryBridge({
    chatIdStr,
    globalUserId,
    saveMessageToMemory,
    saveChatPair,
    getMemoryService,
  });

  const { insertAssistantReply, saveAssistantEarlyReturn } =
    createAssistantReplyPersistence({
      MAX_CHAT_MESSAGE_CHARS: 16000,
      chatIdStr,
      senderIdStr,
      messageId,
      globalUserId,
      msg,
      memoryWrite,
    });

  hydrateRecentRuntimeDocumentIntoCaches({
    chatId,
    chatIdStr,
    messageId,
    FileIntake,
  });

  return {
    messageId,
    monarchNow,
    memory,
    memoryWrite,
    insertAssistantReply,
    saveAssistantEarlyReturn,
  };
}

export default {
  bootstrapChatHandler,
};