// src/bot/handlers/chat/chatAiPostProcessingFlow.js

import { finalizeChatReply } from "./postReplyFlow.js";
import { handlePostAiExportPersistence } from "./chatPostAiPersistenceFlow.js";

export async function runChatAiPostProcessing({
  aiReply,
  insertAssistantReply,
  memoryWrite,
  assistantMemoryMeta,
  sanitizeNonMonarchReply,
  monarchNow,
  bot,
  chatId,
  effective,
  senderIdStr,
  chatIdStr,
  messageId,
  globalUserId,
  sourceCtx,
  longTermMemoryBridgeResult,
  longTermMemoryInjected,
  answerMode,
  mediaResponseMode,
  FileIntake,
}) {
  await insertAssistantReply(aiReply, { stage: "final" });

  await memoryWrite({
    role: "assistant",
    content: aiReply,
    transport: "telegram",
    metadata: {
      ...assistantMemoryMeta,
    },
    schemaVersion: 2,
  });

  await finalizeChatReply({
    sanitizeNonMonarchReply,
    monarchNow,
    aiReply,
    bot,
    chatId,
    effective,
    senderIdStr,
    chatIdStr,
    messageId,
    globalUserId,
    sourceCtx,
    longTermMemoryBridgeResult,
    longTermMemoryInjected,
  });

  handlePostAiExportPersistence({
    chatId,
    aiReply,
    answerMode,
    mediaResponseMode,
    chatIdStr,
    messageId,
    FileIntake,
    effective,
  });

  return { ok: true };
}

export default {
  runChatAiPostProcessing,
};
