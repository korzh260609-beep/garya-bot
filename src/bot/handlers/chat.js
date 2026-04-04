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
import isStablePersonalFactQuestion from "./chat/isStablePersonalFactQuestion.js";
import resolveChatIntent from "./chat/intent/resolveChatIntent.js";
import buildBehaviorSnapshot from "./chat/behaviorSnapshot.js";
import {
  saveRecentAssistantReplyForExport,
  saveRecentDocumentForExport,
  saveRecentDocumentSummaryForExport,
  saveRecentDocumentCurrentPartForExport,
  saveRecentAssistantAnswerAboutDocumentForExport,
  getExplicitExportCandidate,
  getRecentDocumentExportCandidate,
  getRecentAssistantReplyExportCandidate,
  getDocumentExportTargetCandidate,
} from "./chat/outputSessionCache.js";
import { resolveDocumentExportTarget } from "./chat/documentExportTargetResolver.js";
import {
  savePendingClarification,
  getPendingClarification,
  clearPendingClarification,
} from "./chat/clarificationSessionCache.js";
import {
  resolveExportSourceClarification,
  resolveDocumentExportTargetClarification,
} from "./chat/exportClarificationResolver.js";
import {
  resolveRecentDocumentEstimateCandidate,
  resolveRecentDocumentPartsCandidate,
} from "./chat/documentEstimateBridge.js";
import { resolveDocumentEstimateClarification } from "./chat/documentEstimateClarificationResolver.js";
import { resolveDocumentPartRequest } from "./chat/documentPartRequestResolver.js";
import { saveActiveDocumentContext } from "./chat/activeDocumentContextCache.js";
import {
  getActiveEstimateContext,
} from "./chat/activeEstimateContextCache.js";
import {
  safeText,
  normalizeFileBaseName,
  normalizeRequestedOutputFormat,
  normalizePreferredExportKind,
  normalizeDocumentExportTarget,
  isDocumentRelatedSourceKind,
} from "./chat/chatShared.js";
import {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
  hydrateRecentRuntimeDocumentIntoCaches,
} from "./chat/chatContextCacheHelpers.js";
import {
  buildCreatedExportFile,
  sendCreatedExportFile,
} from "./chat/chatExportFlow.js";
import {
  buildEstimateReplyText,
  buildEstimateFollowUpReplyText,
  saveSuccessfulEstimateContext,
} from "./chat/chatEstimateReplies.js";
import {
  buildRequestedDocumentPartReply,
  buildInvalidRequestedPartReply,
} from "./chat/chatDocumentPartReplies.js";
import { tryHandleEstimateCorrection } from "./chat/chatEstimateCorrectionFlow.js";
import { tryHandleDocumentPartRequest } from "./chat/chatDocumentPartFlow.js";
import { tryHandleActiveEstimateFollowUp } from "./chat/chatEstimateFollowupFlow.js";
import { tryHandleDocumentChatEstimate } from "./chat/chatDocumentEstimateFlow.js";
import { tryHandleRecentExport } from "./chat/chatRecentExportFlow.js";

async function continuePendingClarificationIfAny({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
  FileIntake,
  chatIdStr,
  messageId,
}) {
  const pending = getPendingClarification(msg?.chat?.id ?? null);
  if (!pending) return { handled: false };

  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  if (pending.kind === "document_part_request") {
    const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);

    if (!activeEstimate?.estimate?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const resolved = await resolveDocumentPartRequest({
      callAI,
      userText,
      estimateContext: activeEstimate,
    });

    if (resolved?.needsClarification || !resolved?.requestedPartNumber) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        safeText(pending?.question) ||
        "Какую именно часть документа показать?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_part_request",
        question,
        payload: pending?.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_part_request_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    const resolvedParts = resolveRecentDocumentPartsCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    if (!resolvedParts?.ok) {
      const text = "Не вижу активный документ, из которого можно показать часть.";
      await saveAssistantEarlyReturn(text, "document_part_request_no_document");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const requestedPartNumber = Number(resolved?.requestedPartNumber || 0);
    const replyText = buildRequestedDocumentPartReply({
      resolvedParts,
      requestedPartNumber,
    });

    if (!replyText) {
      const text = buildInvalidRequestedPartReply({
        resolvedParts,
        requestedPartNumber,
      });

      await saveAssistantEarlyReturn(text, "document_part_request_invalid_part");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    saveRecentDocumentCurrentPartForExport({
      chatId,
      text: replyText,
      baseName: `${normalizeFileBaseName(
        resolvedParts?.fileName || "document"
      )}_part_${requestedPartNumber}`,
      meta: {
        source: "document_requested_part",
        fileName: resolvedParts?.fileName || null,
        partNumber: requestedPartNumber,
        chunkCount: resolvedParts?.chunkCount || 0,
        chatIdStr,
        messageId,
      },
    });

    saveDocumentExportTargetContext({
      chatId: msg?.chat?.id ?? null,
      target: "current_part",
      chatIdStr,
      messageId,
      reason: "document_requested_part",
    });

    saveExportSourceContext({
      chatId: msg?.chat?.id ?? null,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_requested_part",
    });

    await saveAssistantEarlyReturn(replyText, "document_part_request");
    await bot.sendMessage(chatId, replyText);
    return { handled: true };
  }

  if (pending.kind === "document_estimate_followup_detail") {
    const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);

    if (!activeEstimate?.estimate?.ok) {
      clearPendingClarification(msg?.chat?.id ?? null);
      return { handled: false };
    }

    const resolved = await resolveDocumentEstimateClarification({
      callAI,
      userText,
      hasRecentDocument: true,
      hasRecentDocumentCandidate: true,
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        safeText(pending?.question) ||
        "Уточни, что именно посчитать по последнему документу?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_estimate_followup_detail",
        question,
        payload: pending?.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_estimate_followup_detail_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    if (!resolved?.resolved || !resolved?.refersToRecentDocument) {
      clearPendingClarification(msg?.chat?.id ?? null);
      const text =
        "Не смог понять, относится ли это уточнение к последнему документу.";
      await saveAssistantEarlyReturn(
        text,
        "document_estimate_followup_detail_unresolved"
      );
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    const requestedFocus =
      safeText(pending?.payload?.requestedFocus).toLowerCase() ||
      "general_estimate";

    const text = buildEstimateFollowUpReplyText(activeEstimate, requestedFocus);

    if (!text) {
      return { handled: false };
    }

    await saveAssistantEarlyReturn(text, "document_estimate_followup_detail");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  if (pending.kind === "document_estimate_source") {
    const recentRuntimeDocument =
      typeof FileIntake?.getRecentDocumentSessionCache === "function"
        ? FileIntake.getRecentDocumentSessionCache(msg?.chat?.id ?? null)
        : null;

    const recentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    const resolved = await resolveDocumentEstimateClarification({
      callAI,
      userText,
      hasRecentDocument: Boolean(recentRuntimeDocument),
      hasRecentDocumentCandidate: Boolean(recentEstimateCandidate?.ok),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни, о каком недавнем документе идёт речь?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_estimate_source",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_estimate_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    if (!resolved?.resolved || !resolved?.refersToRecentDocument) {
      const text =
        "Не смог понять, о каком документе идёт речь для оценки разбиения.";
      await saveAssistantEarlyReturn(text, "document_estimate_unresolved");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const estimate = resolveRecentDocumentEstimateCandidate({
      chatId: msg?.chat?.id ?? null,
      FileIntake,
    });

    if (!estimate?.ok) {
      const text =
        "Не вижу недавний документ, для которого можно оценить разбиение.";
      await saveAssistantEarlyReturn(
        text,
        "document_estimate_no_recent_document"
      );
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    saveSuccessfulEstimateContext({
      chatId: msg?.chat?.id ?? null,
      estimate,
      chatIdStr,
      messageId,
      reason: "document_estimate_clarification_resolved",
    });

    const text = buildEstimateReplyText(estimate);
    await saveAssistantEarlyReturn(text, "document_chat_estimate");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  if (pending.kind === "export_source") {
    const recentDocument = getRecentDocumentExportCandidate(msg?.chat?.id ?? null);
    const recentAssistantReply = getRecentAssistantReplyExportCandidate(
      msg?.chat?.id ?? null
    );

    const resolved = await resolveExportSourceClarification({
      callAI,
      userText,
      hasRecentDocument: Boolean(recentDocument),
      hasRecentAssistantReply: Boolean(recentAssistantReply),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни: сохранить ответ или документ?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "export_source",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(question, "export_clarification_repeat");
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    const explicitKind = normalizePreferredExportKind(resolved?.sourceKind);
    const requestedFormat = normalizeRequestedOutputFormat(
      pending?.payload?.requestedFormat || "txt"
    );

    let recentExportCandidate = null;

    if (isDocumentRelatedSourceKind(explicitKind)) {
      saveExportSourceContext({
        chatId: msg?.chat?.id ?? null,
        sourceKind: "document",
        chatIdStr,
        messageId,
        reason: "export_source_clarification_document",
      });

      const exportTarget = pending?.payload?.documentTarget || "auto";

      const normalizedDocumentTarget = normalizeDocumentExportTarget(exportTarget);
      if (normalizedDocumentTarget) {
        saveDocumentExportTargetContext({
          chatId: msg?.chat?.id ?? null,
          target: normalizedDocumentTarget,
          chatIdStr,
          messageId,
          reason: "export_source_clarification_payload_target",
        });
      }

      recentExportCandidate = getDocumentExportTargetCandidate(
        msg?.chat?.id ?? null,
        exportTarget
      );
    } else {
      if (explicitKind === "assistant_reply") {
        saveExportSourceContext({
          chatId: msg?.chat?.id ?? null,
          sourceKind: "assistant_reply",
          chatIdStr,
          messageId,
          reason: "export_source_clarification_assistant_reply",
        });
      }

      recentExportCandidate = getExplicitExportCandidate(
        msg?.chat?.id ?? null,
        explicitKind
      );
    }

    clearPendingClarification(msg?.chat?.id ?? null);

    if (!recentExportCandidate) {
      const text =
        explicitKind === "document"
          ? "Не вижу подходящий недавний контент документа для экспорта."
          : "Не вижу недавний ответ SG для экспорта.";
      await saveAssistantEarlyReturn(text, "export_no_recent_session");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const created = buildCreatedExportFile({
      recentExportCandidate,
      requestedFormat,
    });

    const sent = await sendCreatedExportFile({
      bot,
      chatId,
      created,
      saveAssistantEarlyReturn,
    });

    return { handled: true, ok: sent?.ok === true };
  }

  if (pending.kind === "document_export_target") {
    const resolved = await resolveDocumentExportTargetClarification({
      callAI,
      userText,
      hasSummaryCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "summary")
      ),
      hasFullTextCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "full_text")
      ),
      hasCurrentPartCandidate: Boolean(
        getDocumentExportTargetCandidate(msg?.chat?.id ?? null, "current_part")
      ),
      hasAssistantAnswerCandidate: Boolean(
        getDocumentExportTargetCandidate(
          msg?.chat?.id ?? null,
          "assistant_answer_about_document"
        )
      ),
    });

    if (resolved?.needsClarification) {
      const question =
        safeText(resolved?.clarificationQuestion) ||
        "Уточни: нужен summary, полный текст, текущая часть или мой ответ про документ?";
      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_export_target",
        question,
        payload: pending.payload || {},
      });
      await saveAssistantEarlyReturn(
        question,
        "document_export_target_clarification_repeat"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    const target = safeText(resolved?.target).toLowerCase() || "auto";
    const requestedFormat = normalizeRequestedOutputFormat(
      pending?.payload?.requestedFormat || "txt"
    );

    const normalizedDocumentTarget = normalizeDocumentExportTarget(target);
    if (normalizedDocumentTarget) {
      saveDocumentExportTargetContext({
        chatId: msg?.chat?.id ?? null,
        target: normalizedDocumentTarget,
        chatIdStr,
        messageId,
        reason: "document_export_target_clarification_resolved",
      });
    }

    saveExportSourceContext({
      chatId: msg?.chat?.id ?? null,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_export_target_clarification_resolved",
    });

    clearPendingClarification(msg?.chat?.id ?? null);

    const recentExportCandidate = getDocumentExportTargetCandidate(
      msg?.chat?.id ?? null,
      target
    );

    if (!recentExportCandidate) {
      const text = "Не вижу подходящий недавний контент документа для экспорта.";
      await saveAssistantEarlyReturn(text, "export_no_recent_session");
      await bot.sendMessage(chatId, text);
      return { handled: true };
    }

    const created = buildCreatedExportFile({
      recentExportCandidate,
      requestedFormat,
    });

    const sent = await sendCreatedExportFile({
      bot,
      chatId,
      created,
      saveAssistantEarlyReturn,
    });

    return { handled: true, ok: sent?.ok === true };
  }

  return { handled: false };
}

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