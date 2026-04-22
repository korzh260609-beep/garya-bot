// src/bot/handlers/chat/chatAiOrchestrationFlow.js

import { classifyInteraction } from "../../../../classifier.js";
import { resolveChatSourceFlow } from "./sourceFlow.js";
import { resolveLongTermMemoryBridge } from "./longTermMemoryBridge.js";
import { buildChatMessages } from "./promptAssembly.js";
import { resolveAiParams, executeChatAI } from "./aiExecution.js";
import isStablePersonalFactQuestion from "./isStablePersonalFactQuestion.js";
import resolveChatIntent from "./intent/resolveChatIntent.js";
import buildBehaviorSnapshot from "./behaviorSnapshot.js";
import {
  guardProjectContext,
  guardRecallContext,
  guardHistoryMessages,
  guardChatMessages,
  buildChatInputGuardMeta,
} from "./aiInputGuard.js";
import {
  buildSenderMemoryMeta,
  buildAssistantMemoryMeta,
  buildReplyContext,
  resolveHistoryLimit,
} from "./chatAiContextBuilders.js";
import { runChatAiMemoryPrep } from "./chatAiMemoryPrepFlow.js";
import { runChatAiPostProcessing } from "./chatAiPostProcessingFlow.js";

function normalizeResolvedScope(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
  MAX_HISTORY_MESSAGES = 20,
}) {
  const chatIntent = resolveChatIntent({
    text: effective,
  });

  const stablePersonalFactMode = isStablePersonalFactQuestion(effective);
  const currentChatType = String(msg?.chat?.type || "").trim() || "unknown";
  const senderMemoryMeta = buildSenderMemoryMeta(
    msg,
    chatIdStr,
    senderIdStr,
    messageId
  );
  const assistantMemoryMeta = buildAssistantMemoryMeta(msg, chatIdStr, messageId);
  const replyContext = buildReplyContext(msg);
  const historyLimit = resolveHistoryLimit({
    currentChatType,
    defaultLimit: MAX_HISTORY_MESSAGES,
  });

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

  const prepResult = await runChatAiMemoryPrep({
    bot,
    chatId,
    chatIdStr,
    globalUserId,
    userRole,
    effective,
    currentChatType,
    stablePersonalFactMode,
    historyLimit,
    insertAssistantReply,
    saveAssistantEarlyReturn,
  });

  if (prepResult?.handled) {
    return { handled: true };
  }

  const history = Array.isArray(prepResult?.history) ? prepResult.history : [];
  const recallCtx = prepResult?.recallCtx || null;

  const classification = classifyInteraction({
    userText: effective,
  });

  await logInteraction(chatIdStr, classification);

  let projectContextScope = {};
  try {
    if (typeof resolveProjectContextScope === "function") {
      projectContextScope = normalizeResolvedScope(
        await resolveProjectContextScope({
          msg,
          effective,
          sourceCtx,
          chatIntent,
          classification,
        })
      );
    }
  } catch {}

  let projectCtx = "";
  try {
    projectCtx = await loadProjectContext(projectContextScope);
  } catch {}

  const guardedProjectCtx = guardProjectContext(projectCtx);
  const guardedRecallCtx = guardRecallContext(recallCtx || "");
  const guardedHistory = guardHistoryMessages(history, {
    chatType: currentChatType,
    userText: effective,
  });

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
    replyContext,
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
    userText: effective,
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

    replyContextInjected: Boolean(replyContext?.exists),
    replyContextAuthor: replyContext?.authorLabel || "",
    replyContextHasText: Boolean(replyContext?.replyText),

    historyRequestedLimit: historyLimit,
    historyChatType: currentChatType,

    projectContextScopeProjectArea: projectContextScope?.projectArea || "",
    projectContextScopeRepo: projectContextScope?.repoScope || "",
    projectContextScopeLinkedArea: projectContextScope?.linkedArea || "",
    projectContextScopeLinkedRepo: projectContextScope?.linkedRepo || "",
    projectContextScopeCrossRepo:
      typeof projectContextScope?.crossRepo === "boolean"
        ? projectContextScope.crossRepo
        : null,

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

  await runChatAiPostProcessing({
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