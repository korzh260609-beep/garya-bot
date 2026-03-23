// src/bot/handlers/chat.js
// STAGE 11.x stable personal fact early routing fix (production-safe)

import pool from "../../../db.js";
import { getMemoryService } from "../../core/memoryServiceFactory.js";
import { resolveFileIntakeDecision } from "./chat/fileIntakeDecision.js";
import { createChatMemoryBridge } from "./chat/memoryBridge.js";
import { createAssistantReplyPersistence } from "./chat/assistantReplyPersistence.js";
import { resolveChatSourceFlow } from "./chat/sourceFlow.js";
import { resolveLongTermMemoryBridge } from "./chat/longTermMemoryBridge.js";
import { tryBuildRobotPriceReply } from "./chat/robotPrice.js";
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
import { isStablePersonalFactQuestion } from "./chat/isStablePersonalFactQuestion.js";

export async function handleChatMessage({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  trimmed,
  bypass,
  MAX_HISTORY_MESSAGES = 20,
  globalUserId = null,
  userRole = "guest",
  FileIntake,
  saveMessageToMemory,
  getChatHistory,
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
  if (!trimmed) return;

  const MAX_CHAT_MESSAGE_CHARS = 16000;
  const monarchNow = typeof isMonarch === "function"
    ? isMonarch(senderIdStr)
    : false;

  const { memory, memoryWrite, memoryWritePair } =
    createChatMemoryBridge({
      chatIdStr,
      globalUserId,
      saveMessageToMemory,
      saveChatPair,
      getMemoryService,
    });

  const {
    insertAssistantReply,
    touchAssistantChatMeta,
    saveAssistantEarlyReturn,
  } = createAssistantReplyPersistence({
    MAX_CHAT_MESSAGE_CHARS,
    chatIdStr,
    senderIdStr,
    messageId,
    globalUserId,
    msg,
    memoryWrite,
  });

  const { effective, shouldCallAI, directReplyText } =
    resolveFileIntakeDecision({ FileIntake, msg, trimmed });

  const {
    sourceCtx,
    sourceResultSystemMessage,
    sourceServiceSystemMessage,
  } = await resolveChatSourceFlow({ effective });

  const {
    longTermMemoryBridgeResult,
    longTermMemorySystemMessage,
    longTermMemoryInjected,
  } = await resolveLongTermMemoryBridge({
    chatIdStr,
    globalUserId,
    memory,
  });

  if (directReplyText) {
    await saveAssistantEarlyReturn(directReplyText, "directReplyText");
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI) {
    const text = "Напиши текстом, что нужно сделать.";
    await saveAssistantEarlyReturn(text, "shouldCallAI_false");
    await bot.sendMessage(chatId, text);
    return;
  }

  await memoryWrite({
    role: "user",
    content: effective,
    transport: "telegram",
    metadata: { senderIdStr, chatIdStr, messageId },
    schemaVersion: 2,
  });

  const stablePersonalFactMode =
    isStablePersonalFactQuestion(effective);

  // HISTORY
  let history = [];
  try {
    const memoryLocal = getMemoryService();
    history = await memoryLocal.recent({
      chatId: chatIdStr,
      globalUserId,
      limit: MAX_HISTORY_MESSAGES,
    });
  } catch {}

  const classification = {
    taskType: "chat",
    aiCostLevel: "low",
  };

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

  let recallCtx = null;

  // 🔥 EARLY STABLE PERSONAL FACT ROUTING
  if (!stablePersonalFactMode) {

    recallCtx = await buildChatRecallContext({
      pool,
      chatIdStr,
      globalUserId,
      effective,
      userTz,
    });

    const deterministicResult =
      await tryHandleDeterministicTimeReplies({
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
          stage: "7B.already_seen_hint",
        });
      },
    });
  }

  const { messages } = buildChatMessages({
    buildSystemPrompt,
    answerMode,
    projectCtx,
    monarchNow,
    msg,
    effective,
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    recallCtx,
    history,
  });

  const { maxTokens, temperature } =
    resolveAiParams(answerMode);

  const aiMetaBase = {
    handler: "chat",
    reason: "chat.reply",
    aiCostLevel: classification.aiCostLevel,
    answerMode,
    max_completion_tokens: maxTokens,
    temperature,
    chatId: chatIdStr,
    senderId: senderIdStr,
    messageId,
    globalUserId,
    sourceServiceDecision:
      sourceCtx?.sourcePlan?.decision || "unknown",
    sourceRuntimeDecision:
      sourceCtx?.sourceRuntime?.decision || "unknown",
    sourceRuntimeNeedsSource:
      Boolean(sourceCtx?.sourceRuntime?.needsSource),
    sourceReason: sourceCtx?.reason || "unknown",
    sourceResultOk:
      Boolean(sourceCtx?.sourceResult?.ok),
    sourceResultKey:
      sourceCtx?.sourceResult?.sourceKey || null,
    longTermMemoryBridgePrepared:
      Boolean(longTermMemoryBridgeResult),
    longTermMemoryBridgeOk:
      Boolean(longTermMemoryBridgeResult?.ok),
    longTermMemoryBridgeReason:
      longTermMemoryBridgeResult?.reason || null,
    longTermMemoryInjected,
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

  await insertAssistantReply(aiReply, {
    stage: "stable_fact_fix",
  });

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
}