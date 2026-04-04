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
import {
  saveRecentAssistantReplyForExport,
  saveRecentDocumentForExport,
  saveRecentDocumentSummaryForExport,
  saveRecentDocumentCurrentPartForExport,
  saveRecentAssistantAnswerAboutDocumentForExport,
} from "./chat/outputSessionCache.js";
import { saveActiveDocumentContext } from "./chat/activeDocumentContextCache.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
  hydrateRecentRuntimeDocumentIntoCaches,
} from "./chat/chatContextCacheHelpers.js";
import { tryHandleEstimateCorrection } from "./chat/chatEstimateCorrectionFlow.js";
import { tryHandleDocumentPartRequest } from "./chat/chatDocumentPartFlow.js";
import { tryHandleActiveEstimateFollowUp } from "./chat/chatEstimateFollowupFlow.js";
import { tryHandleDocumentChatEstimate } from "./chat/chatDocumentEstimateFlow.js";
import { tryHandleRecentExport } from "./chat/chatRecentExportFlow.js";
import { continuePendingClarificationIfAny } from "./chat/chatPendingClarificationFlow.js";

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

  if (directReplyText) {
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

    return;
  }

  if (!shouldCallAI) {
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

    return;
  }

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

  saveRecentAssistantReplyForExport({
    chatId,
    text: aiReply,
    baseName: "assistant_reply",
    meta: {
      source: "ai_reply",
      chatIdStr,
      messageId,
      answerMode,
      mediaResponseMode: mediaResponseMode || null,
    },
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "assistant_reply",
    chatIdStr,
    messageId,
    reason:
      mediaResponseMode && mediaResponseMode.startsWith("document_")
        ? "document_mode_assistant_reply_saved"
        : "ai_reply",
  });

  if (mediaResponseMode === "document_summary_answer") {
    saveRecentDocumentSummaryForExport({
      chatId,
      text: aiReply,
      baseName: "document_summary",
      meta: {
        source: "document_summary_answer",
        chatIdStr,
        messageId,
      },
    });

    saveRecentAssistantAnswerAboutDocumentForExport({
      chatId,
      text: aiReply,
      baseName: "document_answer",
      meta: {
        source: "assistant_answer_about_document",
        chatIdStr,
        messageId,
      },
    });

    saveDocumentExportTargetContext({
      chatId,
      target: "summary",
      chatIdStr,
      messageId,
      reason: "document_summary_answer",
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_summary_answer",
    });
  }

  if (mediaResponseMode === "document_full_text_answer") {
    saveRecentDocumentCurrentPartForExport({
      chatId,
      text: aiReply,
      baseName: "document_part",
      meta: {
        source: "document_current_part",
        chatIdStr,
        messageId,
      },
    });

    saveDocumentExportTargetContext({
      chatId,
      target: "current_part",
      chatIdStr,
      messageId,
      reason: "document_full_text_answer",
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_full_text_answer",
    });
  }

  if (mediaResponseMode && mediaResponseMode.startsWith("document_")) {
    const recentRuntimeDocument =
      typeof FileIntake?.getRecentDocumentSessionCache === "function"
        ? FileIntake.getRecentDocumentSessionCache(chatId)
        : null;

    const rawDocumentText = recentRuntimeDocument?.text || effective;
    const rawDocumentFileName =
      recentRuntimeDocument?.fileName || recentRuntimeDocument?.title || "document_context";

    saveRecentDocumentForExport({
      chatId,
      text: rawDocumentText,
      baseName: rawDocumentFileName,
      meta: {
        source: recentRuntimeDocument?.text
          ? "document_runtime_text"
          : "document_effective_context",
        fileName: recentRuntimeDocument?.fileName || null,
        title: recentRuntimeDocument?.title || null,
        chatIdStr,
        messageId,
      },
    });

    saveActiveDocumentContext({
      chatId,
      fileName: recentRuntimeDocument?.fileName || "",
      title: recentRuntimeDocument?.title || "",
      text: rawDocumentText,
      source: recentRuntimeDocument?.text
        ? "document_runtime_text"
        : "document_effective_context",
      meta: {
        chatIdStr,
        messageId,
      },
    });

    saveExportSourceContext({
      chatId,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_context_active",
    });
  }
}

export default handleChatMessage;