// src/bot/handlers/chat.js
// STAGE 11.x FULL stable personal fact isolation
// + STAGE 12A.2 minimal document output wiring
// + recent assistant-reply export
// + semantic export source selection: document / assistant reply
// + semantic document follow-up wiring
// + semantic document export target selection
// + pending clarification state for export flow
// + semantic document chat split estimate

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
  createDocumentOutputFile,
  cleanupDocumentOutputFile,
} from "../../documents/documentOutputService.js";
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
import { resolveExportIntent } from "./chat/exportIntentResolver.js";
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
import { resolveDocumentChatEstimateIntent } from "./chat/documentChatEstimateResolver.js";

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeFileBaseName(value) {
  const src = safeText(value) || "document";
  return (
    src
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s+/g, "_")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+/, "")
      .replace(/_+$/, "") || "document"
  );
}

function normalizeRequestedOutputFormat(value) {
  const src = safeText(value).toLowerCase();

  if (src === "txt") return "txt";
  if (src === "md") return "md";
  if (src === "pdf") return "pdf";
  if (src === "docx") return "docx";
  if (src === "auto") return "txt";

  return "txt";
}

function normalizePreferredExportKind(value) {
  const src = safeText(value).toLowerCase();

  if (src === "document") return "document";
  if (src === "assistant_reply") return "assistant_reply";
  return "";
}

function isDocumentRelatedSourceKind(value) {
  const src = safeText(value).toLowerCase();
  return src === "document";
}

function buildCreatedExportFile({
  recentExportCandidate,
  requestedFormat,
}) {
  const baseName = normalizeFileBaseName(
    recentExportCandidate?.baseName ||
      recentExportCandidate?.meta?.fileName ||
      recentExportCandidate?.meta?.title ||
      (recentExportCandidate?.kind === "document"
        ? "document"
        : "assistant_reply")
  );

  return createDocumentOutputFile({
    text: recentExportCandidate?.text || "",
    baseName,
    format: requestedFormat,
  });
}

async function sendCreatedExportFile({
  bot,
  chatId,
  created,
  saveAssistantEarlyReturn,
}) {
  if (!created?.ok) {
    let text = "Не удалось сформировать файл.";

    if (created?.error === "document_output_pdf_not_connected_current_stage") {
      text = "PDF-генерация ещё не подключена. Сейчас могу отдать TXT или MD.";
    } else if (
      created?.error === "document_output_docx_not_connected_current_stage"
    ) {
      text = "DOCX-генерация ещё не подключена. Сейчас могу отдать TXT или MD.";
    } else if (created?.error === "document_output_format_not_supported") {
      text = "Этот формат пока не поддерживается. Сейчас доступны TXT и MD.";
    } else if (created?.error === "document_output_empty_text") {
      text = "Не удалось создать файл: нет текста для экспорта.";
    }

    await saveAssistantEarlyReturn(text, "export_failed");
    await bot.sendMessage(chatId, text);
    return { handled: true, ok: false };
  }

  try {
    await bot.sendDocument(chatId, created.filePath, {
      caption: `Готово: ${created.fileName}`,
    });

    await saveAssistantEarlyReturn(
      `Файл сформирован и отправлен: ${created.fileName}`,
      "export_sent"
    );

    return {
      handled: true,
      ok: true,
      fileName: created.fileName,
      format: created.format,
    };
  } catch (error) {
    const text = "Файл создался, но отправка в Telegram не сработала.";
    await saveAssistantEarlyReturn(text, "export_send_failed");
    await bot.sendMessage(chatId, text);
    return {
      handled: true,
      ok: false,
      error: error?.message ? String(error.message) : "unknown_error",
    };
  } finally {
    cleanupDocumentOutputFile(created.filePath);
  }
}

async function tryHandleDocumentChatEstimate({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  saveAssistantEarlyReturn,
  callAI,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  const estimateRecentDocumentChatSplit =
    typeof FileIntake?.estimateRecentDocumentChatSplit === "function"
      ? FileIntake.estimateRecentDocumentChatSplit
      : null;

  if (!getRecentDocumentSessionCache || !estimateRecentDocumentChatSplit) {
    return { handled: false };
  }

  const recentDocument = getRecentDocumentSessionCache(msg?.chat?.id ?? null);

  const estimateIntent = await resolveDocumentChatEstimateIntent({
    callAI,
    userText,
    hasRecentDocument: Boolean(recentDocument),
  });

  if (!estimateIntent?.isEstimateIntent) {
    return { handled: false };
  }

  if (!recentDocument) {
    const text = "Не вижу недавний документ, для которого можно оценить разбиение.";
    await saveAssistantEarlyReturn(text, "document_estimate_no_recent_document");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const estimate = estimateRecentDocumentChatSplit(msg?.chat?.id ?? null);
  if (!estimate?.ok) {
    const text = "Не удалось оценить разбиение документа.";
    await saveAssistantEarlyReturn(text, "document_estimate_failed");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const fileName = safeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0);
  const charCount = Number(estimate?.charCount || 0);
  const chunkSize = Number(estimate?.chunkSize || 0);

  let text = `Если вывести ${fileName} в чат, получится примерно ${chunkCount} частей.`;
  if (chunkCount <= 1) {
    text = `Если вывести ${fileName} в чат, он поместится примерно в 1 сообщение.`;
  }

  if (chunkSize > 0 && charCount > 0) {
    text += ` Основа оценки: около ${charCount} символов текста при лимите ~${chunkSize} символов на часть.`;
  }

  await saveAssistantEarlyReturn(text, "document_chat_estimate");
  await bot.sendMessage(chatId, text);
  return { handled: true };
}

async function continuePendingClarificationIfAny({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
}) {
  const pending = getPendingClarification(msg?.chat?.id ?? null);
  if (!pending) return { handled: false };

  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

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
      const exportTarget = pending?.payload?.documentTarget || "auto";
      recentExportCandidate = getDocumentExportTargetCandidate(
        msg?.chat?.id ?? null,
        exportTarget
      );
    } else {
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

async function tryHandleRecentExport({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
}) {
  const clarificationContinuation = await continuePendingClarificationIfAny({
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
  });

  if (clarificationContinuation?.handled) {
    return clarificationContinuation;
  }

  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const recentDocument = getRecentDocumentExportCandidate(msg?.chat?.id ?? null);
  const recentAssistantReply = getRecentAssistantReplyExportCandidate(
    msg?.chat?.id ?? null
  );

  const exportIntent = await resolveExportIntent({
    callAI,
    userText,
    hasRecentDocument: Boolean(recentDocument),
    hasRecentAssistantReply: Boolean(recentAssistantReply),
  });

  if (!exportIntent?.isExportIntent) {
    return { handled: false };
  }

  if (exportIntent?.needsClarification) {
    const question =
      safeText(exportIntent?.clarificationQuestion) ||
      "Уточни: сохранить ответ или документ?";

    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "export_source",
      question,
      payload: {
        requestedFormat: normalizeRequestedOutputFormat(exportIntent?.format),
        documentTarget: "auto",
      },
    });

    await saveAssistantEarlyReturn(question, "export_clarification");
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const explicitKind = normalizePreferredExportKind(exportIntent?.sourceKind);
  const requestedFormat = normalizeRequestedOutputFormat(exportIntent?.format);

  let recentExportCandidate = null;

  if (isDocumentRelatedSourceKind(explicitKind)) {
    const exportTarget = await resolveDocumentExportTarget({
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

    if (exportTarget?.needsClarification) {
      const question =
        safeText(exportTarget?.clarificationQuestion) ||
        "Уточни: нужен summary, полный текст, текущая часть или мой ответ про документ?";

      savePendingClarification({
        chatId: msg?.chat?.id ?? null,
        kind: "document_export_target",
        question,
        payload: {
          requestedFormat,
        },
      });

      await saveAssistantEarlyReturn(
        question,
        "document_export_target_clarification"
      );
      await bot.sendMessage(chatId, question);
      return { handled: true };
    }

    recentExportCandidate = getDocumentExportTargetCandidate(
      msg?.chat?.id ?? null,
      exportTarget?.target || "auto"
    );
  } else {
    recentExportCandidate = getExplicitExportCandidate(
      msg?.chat?.id ?? null,
      explicitKind
    );
  }

  if (!recentExportCandidate) {
    let text =
      "Не вижу недавний документ или ответ для экспорта. Сначала отправь файл или получи ответ SG.";

    if (explicitKind === "assistant_reply") {
      text = "Не вижу недавний ответ SG для экспорта.";
    } else if (explicitKind === "document") {
      text = "Не вижу подходящий недавний контент документа для экспорта.";
    }

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

  return {
    handled: true,
    ok: sent?.ok === true,
    sourceKind: recentExportCandidate?.kind || "unknown",
  };
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

  const estimateResult = await tryHandleDocumentChatEstimate({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    saveAssistantEarlyReturn,
    callAI,
  });

  if (estimateResult?.handled) {
    return;
  }

  const exportResult = await tryHandleRecentExport({
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
  });

  if (exportResult?.handled) {
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
  }

  if (mediaResponseMode && mediaResponseMode.startsWith("document_")) {
    saveRecentDocumentForExport({
      chatId,
      text: effective,
      baseName: "document_context",
      meta: {
        source: "document_effective_context",
        chatIdStr,
        messageId,
      },
    });
  }
}

export default handleChatMessage;