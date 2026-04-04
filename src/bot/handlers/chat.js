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

import pool from "../../../db.js";
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { resolveFileIntakeDecision } from "./chat/fileIntakeDecision.js";
import { createChatMemoryBridge } from "./chat/memoryBridge.js";
import { createAssistantReplyPersistence } from "./chat/assistantReplyPersistence.js";
import { resolveChatSourceFlow } from "./chat/sourceFlow.js";
import { resolveLongTermMemoryBridge } from "./chat/longTermMemoryBridge.js";
import {
  resolveUserTimezoneState,
  tryHandleMissingTimezoneFlow,
  tryHandleDeterministicTimeReplies,
} from "./chat/timezoneFlow.js";
import { buildChatRecallContext } from "./chat/recallFlow.js";
import { runAlreadySeenFlow } from "./chat/alreadySeenFlow.js";
import { buildChatMessages } from "./chat/promptAssembly.js";
import { resolveAiParams, executeChatAI } from "./chat/aiExecution.js";
import { finalizeChatReply } from "./chat/postReplyFlow.js";
import isStablePersonalFactQuestion from "./chat/isStablePersonalFactQuestion.js";
import resolveChatIntent from "./chat/intent/resolveChatIntent.js";
import buildBehaviorSnapshot from "./chat/behaviorSnapshot.js";
import { hydrateRecentRuntimeDocumentIntoCaches } from "./chat/chatContextCacheHelpers.js";
import { tryHandleEstimateCorrection } from "./chat/chatEstimateCorrectionFlow.js";
import { tryHandleDocumentPartRequest } from "./chat/chatDocumentPartFlow.js";
import { tryHandleActiveEstimateFollowUp } from "./chat/chatEstimateFollowupFlow.js";
import { tryHandleDocumentChatEstimate } from "./chat/chatDocumentEstimateFlow.js";
import { tryHandleRecentExport } from "./chat/chatRecentExportFlow.js";
import { continuePendingClarificationIfAny } from "./chat/chatPendingClarificationFlow.js";
import {
  handleDirectReplyEarlyReturn,
  handleNoAiEarlyReturn,
} from "./chat/chatEarlyReturnFlow.js";
import { handlePostAiExportPersistence } from "./chat/chatPostAiPersistenceFlow.js";

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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
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
    return;
  }

  const chatIntent = resolveChatIntent({
    text: effective,
  });

  const stablePersonalFactMode = isStablePersonalFactQuestion(effective);

  const { sourceCtx, sourceResultSystemMessage, sourceServiceSystemMessage } =
    await resolveChatSourceFlow({ effective });

  const {
    longTermMemoryBridgeResult,
    longTermMemorySystemMessage,
    longTermMemoryInjected,
  } = await resolveLongTermMemoryBridge({
    chatIdStr,
    globalUserId,
    memory,
    effective,
  });

  await memoryWrite({
    role: "user",
    content: effective,
    transport: "telegram",
    metadata: { senderIdStr, chatIdStr, messageId },
    schemaVersion: 2,
  });

  let history = [];
  let recallCtx = null;

  const { userTz, timezoneMissing } =
    await resolveUserTimezoneState(globalUserId);

  if (timezoneMissing) {
    const result = await tryHandleMissingTimezoneFlow({
      effective,
      globalUserId,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });
    if (result?.handled) return;
  }

  if (!stablePersonalFactMode) {
    try {
      const memoryLocal = getMemoryService();
      history = await memoryLocal.recent({
        chatId: chatIdStr,
        globalUserId,
        limit: MAX_HISTORY_MESSAGES,
      });
    } catch {}

    recallCtx = await buildChatRecallContext({
      pool,
      chatIdStr,
      globalUserId,
      effective,
      userTz,
    });

    const deterministicResult = await tryHandleDeterministicTimeReplies({
      effective,
      userTz,
      recallCtx,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });

    if (deterministicResult?.handled) return;

    await runAlreadySeenFlow({
      bot,
      chatId,
      chatIdStr,
      globalUserId,
      effective,
      userRole,
      saveAssistantHint: async (hintText) => {
        await insertAssistantReply(hintText, {
          stage: "already_seen",
        });
      },
    });
  }

  const classification = { taskType: "chat", aiCostLevel: "high" };
  await logInteraction(chatIdStr, classification);

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch {}

  const answerMode = getAnswerMode(chatIdStr, {
    isMonarch: monarchNow,
    text: effective,
    taskType: classification.taskType,
    aiCostLevel: classification.aiCostLevel,
  });

  const { messages } = buildChatMessages({
    buildSystemPrompt,
    answerMode,
    projectCtx,
    monarchNow,
    msg,
    effective,
    mediaResponseMode,
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    recallCtx,
    history,
  });

  const { maxTokens, temperature } = resolveAiParams(answerMode);

  const behaviorSnapshot = buildBehaviorSnapshot({
    userText: effective,
    intent: chatIntent,
  });

  const aiMetaBase = {
    handler: "chat",
    stablePersonalFactMode,
    longTermMemoryInjected,
    longTermMemoryBridgePrepared: Boolean(longTermMemoryBridgeResult),

    chatIntentMode: chatIntent?.mode || "normal",
    chatIntentDomain: chatIntent?.domain || "unknown",
    chatIntentCandidateSlots: Array.isArray(chatIntent?.candidateSlots)
      ? chatIntent.candidateSlots
      : [],

    ...behaviorSnapshot,
  };

  const { aiReply } = await executeChatAI({
    callAI,
    filtered: messages,
    classification,
    maxTokens,
    temperature,
    monarchNow,
    logInteraction,
    aiMetaBase,
    globalUserId,
    chatIdStr,
  });

  await insertAssistantReply(aiReply, { stage: "final" });

  await memoryWritePair({
    userText: effective,
    assistantText: aiReply,
    transport: "telegram",
    metadata: { senderIdStr, chatIdStr, messageId },
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
}

export default handleChatMessage;