// src/bot/handlers/chat/chatAiOrchestrationFlow.js

import pool from "../../../../db.js";
import { classifyInteraction } from "../../../../classifier.js";
import { getMemoryService } from "../../../core/memoryServiceFactory.js";
import { resolveChatSourceFlow } from "./sourceFlow.js";
import { resolveLongTermMemoryBridge } from "./longTermMemoryBridge.js";
import {
  resolveUserTimezoneState,
  tryHandleMissingTimezoneFlow,
  tryHandleDeterministicTimeReplies,
} from "./timezoneFlow.js";
import { buildChatRecallContext } from "./recallFlow.js";
import { runAlreadySeenFlow } from "./alreadySeenFlow.js";
import { buildChatMessages } from "./promptAssembly.js";
import { resolveAiParams, executeChatAI } from "./aiExecution.js";
import { finalizeChatReply } from "./postReplyFlow.js";
import isStablePersonalFactQuestion from "./isStablePersonalFactQuestion.js";
import resolveChatIntent from "./intent/resolveChatIntent.js";
import buildBehaviorSnapshot from "./behaviorSnapshot.js";
import { handlePostAiExportPersistence } from "./chatPostAiPersistenceFlow.js";
import {
  guardProjectContext,
  guardRecallContext,
  guardHistoryMessages,
  guardChatMessages,
  buildChatInputGuardMeta,
} from "./aiInputGuard.js";

function buildSenderMemoryMeta(msg, chatIdStr, senderIdStr, messageId) {
  const firstName = String(msg?.from?.first_name || "").trim();
  const lastName = String(msg?.from?.last_name || "").trim();
  const username = String(msg?.from?.username || "").trim();
  const chatType = String(msg?.chat?.type || "").trim() || "unknown";
  const senderName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    senderIdStr,
    chatIdStr,
    messageId,
    chatType,
    senderFirstName: firstName,
    senderLastName: lastName,
    senderUsername: username,
    senderName: senderName || (username ? `@${username}` : ""),
  };
}

export async function runChatAiOrchestration({
  bot,
  msg,
  chatId,
  chatIdStr,
  senderIdStr,
  globalUserId = null,
  userRole = "guest",
  FileIntake,
  effective,
  mediaResponseMode,
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
  MAX_HISTORY_MESSAGES = 20,
}) {
  const chatIntent = resolveChatIntent({
    text: effective,
  });

  const stablePersonalFactMode = isStablePersonalFactQuestion(effective);
  const currentChatType = String(msg?.chat?.type || "").trim() || "unknown";
  const senderMemoryMeta = buildSenderMemoryMeta(msg, chatIdStr, senderIdStr, messageId);

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
    metadata: {
      ...senderMemoryMeta,
    },
    schemaVersion: 2,
  });

  let history = [];
  let recallCtx = null;

  const { userTz, timezoneMissing } = await resolveUserTimezoneState(globalUserId);

  if (timezoneMissing) {
    const result = await tryHandleMissingTimezoneFlow({
      effective,
      globalUserId,
      saveAssistantEarlyReturn,
      bot,
      chatId,
    });
    if (result?.handled) return { handled: true };
  }

  if (!stablePersonalFactMode) {
    try {
      const memoryLocal = getMemoryService();
      history = await memoryLocal.recent({
        chatId: chatIdStr,
        globalUserId,
        limit: MAX_HISTORY_MESSAGES,
        chatType: currentChatType,
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

    if (deterministicResult?.handled) return { handled: true };

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

  const classification = classifyInteraction({
    userText: effective,
  });

  await logInteraction(chatIdStr, classification);

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext();
  } catch {}

  const guardedProjectCtx = guardProjectContext(projectCtx);
  const guardedRecallCtx = guardRecallContext(recallCtx || "");
  const guardedHistory = guardHistoryMessages(history);

  const answerMode = getAnswerMode(chatIdStr, {
    isMonarch: monarchNow,
    text: effective,
    taskType: classification.taskType,
    aiCostLevel: classification.aiCostLevel,
  });

  const { messages, promptBlockDiagnostics } = buildChatMessages({
    buildSystemPrompt,
    answerMode,
    projectCtx: guardedProjectCtx,
    monarchNow,
    msg,
    effective,
    mediaResponseMode,
    sourceServiceSystemMessage,
    sourceResultSystemMessage,
    longTermMemorySystemMessage,
    recallCtx: guardedRecallCtx,
    history: guardedHistory,
  });

  const guardedMessages = guardChatMessages(messages);

  const { maxTokens, temperature } = resolveAiParams(answerMode);

  const behaviorSnapshot = buildBehaviorSnapshot({
    userText: effective,
    intent: chatIntent,
  });

  const inputGuardMeta = buildChatInputGuardMeta({
    rawProjectCtx: projectCtx,
    rawRecallCtx: recallCtx || "",
    rawHistory: history,
    rawMessages: messages,
    guardedProjectCtx,
    guardedRecallCtx,
    guardedHistory,
    guardedMessages,
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
    ...inputGuardMeta,
    ...promptBlockDiagnostics,
  };

  const { aiReply } = await executeChatAI({
    callAI,
    filtered: guardedMessages,
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

  await memoryWrite({
    role: "assistant",
    content: aiReply,
    transport: "telegram",
    metadata: {
      ...senderMemoryMeta,
      assistantLabel: "sg_assistant",
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

  return {
    handled: true,
    aiReply,
    answerMode,
  };
}

export default {
  runChatAiOrchestration,
};