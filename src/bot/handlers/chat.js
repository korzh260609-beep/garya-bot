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

import { bootstrapChatHandler } from "./chat/chatBootstrapFlow.js";
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
  resolveProjectContextScope,
  getAnswerMode,
  buildSystemPrompt,
  isMonarch,
  callAI,
  sanitizeNonMonarchReply,
  projectIntentRepoContext = null,
}) {
  const {
    messageId,
    monarchNow,
    memory,
    memoryWrite,
    insertAssistantReply,
    saveAssistantEarlyReturn,
  } = bootstrapChatHandler({
    msg,
    chatId,
    chatIdStr,
    senderIdStr,
    globalUserId,
    saveMessageToMemory,
    saveChatPair,
    isMonarch,
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
    insertAssistantReply,
    saveAssistantEarlyReturn,

    logInteraction,
    loadProjectContext,
    resolveProjectContextScope,
    getAnswerMode,
    buildSystemPrompt,
    callAI,
    sanitizeNonMonarchReply,
    monarchNow,
    MAX_HISTORY_MESSAGES,

    projectIntentRepoContext,
  });
}

export default handleChatMessage;