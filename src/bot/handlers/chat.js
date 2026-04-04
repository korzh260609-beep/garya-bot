// src/bot/handlers/chat.js
// STAGE 11.x FULL stable personal fact isolation
// + STAGE 12A.2 minimal document output wiring
// + recent assistant-reply export
// + semantic export source selection: document / assistant reply
// + semantic document follow-up wiring
// + semantic document export target selection
// + pending clarification state for export flow
// + semantic document chat split estimate
// + estimate fallback bridge for active document resolution
// + pending clarification state for estimate-mode
// + raw document hydration into output cache on every turn
// + active document context cache
// + active estimate context cache
// + semantic estimate follow-up continuation
// + active document export target cache
// + active export source cache
// + pending clarification for estimate follow-up detail
// + estimate correction / rebind to recent document
// + document part request flow
// + export guard against document-in-chat / estimate stealing

import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { createChatMemoryBridge } from "./chat/memoryBridge.js";
import { createAssistantReplyPersistence } from "./chat/assistantReplyPersistence.js";
import { hydrateRecentRuntimeDocumentIntoCaches } from "./chat/chatContextCacheHelpers.js";
import { runChatPreAiRouting } from "./chat/chatPreAiRoutingFlow.js";
import { runChatAiOrchestration } from "./chat/chatAiOrchestrationFlow.js";

export async function handleChatMessage({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  trimmed,
  MAX_HISTORY_MESSAGES = 20,
  globalUserId = null,
  userRole = "guest",
  FileIntake,
  telegramBotToken = "",
  saveMessageToMemory,
  saveChatPair,
  logInteraction,
  loadProjectContext,
  getAnswerMode,
  buildSystemPrompt,
  isMonarch,
  callAI,
  sanitizeNonMonarchReply,
}) {
  const messageId = msg.message_id ?? null;

  const monarchNow =
    typeof isMonarch === "function" ? isMonarch(senderIdStr) : false;

  const { memory, memoryWrite, memoryWritePair } = createChatMemoryBridge({
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

  const preAiResult = await runChatPreAiRouting({
    bot,
    msg,
    chatId,
    chatIdStr,
    trimmed,
    FileIntake,
    telegramBotToken,
    callAI,
    saveAssistantEarlyReturn,
    messageId,
  });

  if (preAiResult?.handled) {
    return;
  }

  await runChatAiOrchestration({
    bot,
    msg,
    chatId,
    chatIdStr,
    senderIdStr,
    globalUserId,
    userRole,
    FileIntake,
    effective: preAiResult?.effective || "",
    mediaResponseMode: preAiResult?.mediaResponseMode || null,
    messageId,

    memory,
    memoryWrite,
    memoryWritePair,
    insertAssistantReply,
    saveAssistantEarlyReturn,

    logInteraction,
    loadProjectContext,
    getAnswerMode,
    buildSystemPrompt,
    callAI,
    sanitizeNonMonarchReply,
    monarchNow,
    MAX_HISTORY_MESSAGES,
  });
}

export default handleChatMessage;