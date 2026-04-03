// src/bot/handlers/chat.js
// STAGE 11.x FULL stable personal fact isolation
// + STAGE 12A.2 minimal document output wiring

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

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function countWords(value) {
  const text = normalizeWhitespace(value);
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function normalizeFileBaseName(value) {
  const src = safeText(value) || "document";
  return src
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s+/g, "_")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "") || "document";
}

function detectRequestedOutputFormat(text) {
  const src = normalizeWhitespace(text).toLowerCase();

  if (!src) return "txt";

  if (
    src.includes("markdown") ||
    src.includes("md файл") ||
    src.includes("md-файл") ||
    src.includes("в md") ||
    src.includes(".md")
  ) {
    return "md";
  }

  if (
    src.includes("pdf") ||
    src.includes("пдф")
  ) {
    return "pdf";
  }

  if (
    src.includes("docx") ||
    src.includes("докс") ||
    src.includes("ворд") ||
    src.includes("word")
  ) {
    return "docx";
  }

  return "txt";
}

function isLikelyDocumentExportRequest(text) {
  const src = normalizeWhitespace(text).toLowerCase();
  if (!src) return false;
  if (src.startsWith("/")) return false;
  if (src.length > 300) return false;

  const words = countWords(src);

  const exportSignals = [
    "сохрани",
    "сохранить",
    "отправь",
    "отправить",
    "сделай файл",
    "создай файл",
    "в файл",
    "файлом",
    "выгрузи",
    "экспорт",
    "экспортируй",
    "download",
    "save as",
    "as file",
  ];

  const documentSignals = [
    "документ",
    "файл",
    "текст",
    "txt",
    "md",
    "markdown",
    "pdf",
    "docx",
    "word",
    "ворд",
  ];

  const hasExportSignal = exportSignals.some((token) => src.includes(token));
  const hasDocumentSignal = documentSignals.some((token) => src.includes(token));

  if (hasExportSignal && hasDocumentSignal) return true;

  if (words <= 8) {
    const shortPatterns = [
      "в txt",
      "в md",
      "текстовым файлом",
      "markdown файлом",
      "как файл",
      "файлом",
    ];

    if (shortPatterns.some((token) => src.includes(token))) {
      return true;
    }
  }

  return false;
}

async function tryHandleRecentDocumentExport({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  saveAssistantEarlyReturn,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  if (!isLikelyDocumentExportRequest(userText)) {
    return { handled: false };
  }

  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  if (!getRecentDocumentSessionCache) {
    return { handled: false };
  }

  const recentDocumentCache = getRecentDocumentSessionCache(msg?.chat?.id ?? null);
  if (!recentDocumentCache) {
    const text = "Не вижу недавний документ в сессии. Сначала отправь файл.";
    await saveAssistantEarlyReturn(text, "document_export_no_recent_session");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  const requestedFormat = detectRequestedOutputFormat(userText);
  const baseName = normalizeFileBaseName(
    recentDocumentCache?.fileName || recentDocumentCache?.title || "document"
  );

  const created = createDocumentOutputFile({
    text: recentDocumentCache?.text || "",
    baseName,
    format: requestedFormat,
  });

  if (!created?.ok) {
    let text = "Не удалось сформировать файл.";

    if (created?.error === "document_output_pdf_not_connected_current_stage") {
      text = "PDF-генерация ещё не подключена. Сейчас могу отдать TXT или MD.";
    } else if (created?.error === "document_output_docx_not_connected_current_stage") {
      text = "DOCX-генерация ещё не подключена. Сейчас могу отдать TXT или MD.";
    } else if (created?.error === "document_output_format_not_supported") {
      text = "Этот формат пока не поддерживается. Сейчас доступны TXT и MD.";
    } else if (created?.error === "document_output_empty_text") {
      text = "Не удалось создать файл: в текущей сессии нет извлечённого текста документа.";
    }

    await saveAssistantEarlyReturn(text, "document_export_failed");
    await bot.sendMessage(chatId, text);
    return { handled: true };
  }

  try {
    await bot.sendDocument(chatId, created.filePath, {
      caption: `Готово: ${created.fileName}`,
    });

    await saveAssistantEarlyReturn(
      `Файл сформирован и отправлен: ${created.fileName}`,
      "document_export_sent"
    );

    return {
      handled: true,
      fileSent: true,
      fileName: created.fileName,
      format: created.format,
    };
  } catch (error) {
    const text = "Файл создался, но отправка в Telegram не сработала.";
    await saveAssistantEarlyReturn(text, "document_export_send_failed");
    await bot.sendMessage(chatId, text);
    return {
      handled: true,
      fileSent: false,
      error: error?.message ? String(error.message) : "unknown_error",
    };
  } finally {
    cleanupDocumentOutputFile(created.filePath);
  }
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
    typeof isMonarch === "function"
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
    saveAssistantEarlyReturn,
  } = createAssistantReplyPersistence({
    MAX_CHAT_MESSAGE_CHARS: 16000,
    chatIdStr,
    senderIdStr,
    messageId,
    globalUserId,
    msg,
    memoryWrite,
  });

  // --------------------------------------------------------------------------
  // STAGE 12A.2 — recent document export path
  // IMPORTANT:
  // - not tied to one exact phrase
  // - works from recent document session cache
  // - safe formats only for now: txt / md
  // --------------------------------------------------------------------------
  const exportResult = await tryHandleRecentDocumentExport({
    bot,
    msg,
    chatId,
    trimmed,
    FileIntake,
    saveAssistantEarlyReturn,
  });

  if (exportResult?.handled) {
    return;
  }

  const {
    effective,
    shouldCallAI,
    directReplyText,
    mediaResponseMode,
  } = await resolveFileIntakeDecision({
    FileIntake,
    msg,
    trimmed,
    telegramBotToken,
  });

  // --------------------------------------------------------------------------
  // STAGE 11F — unified empty guard AFTER file-intake decision
  // IMPORTANT:
  // - text-only empty -> ask user for text
  // - media-only may still produce directReplyText from FileIntake
  // - caption-only is allowed because effective may come from media caption
  // --------------------------------------------------------------------------
  if (!effective && !shouldCallAI && !directReplyText) {
    const text = "Напиши текстом, что нужно сделать.";
    await saveAssistantEarlyReturn(text, "empty");
    await bot.sendMessage(chatId, text);
    return;
  }

  const chatIntent = resolveChatIntent({
    text: effective,
  });

  const stablePersonalFactMode =
    isStablePersonalFactQuestion(effective);

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
    effective,
  });

  if (directReplyText) {
    await saveAssistantEarlyReturn(directReplyText, "direct");
    await bot.sendMessage(chatId, directReplyText);
    return;
  }

  if (!shouldCallAI) {
    const text = "Напиши текстом, что нужно сделать.";
    await saveAssistantEarlyReturn(text, "no_ai");
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

  const { maxTokens, temperature } =
    resolveAiParams(answerMode);

  const behaviorSnapshot = buildBehaviorSnapshot({
    userText: effective,
    intent: chatIntent,
  });

  const aiMetaBase = {
    handler: "chat",
    stablePersonalFactMode,
    longTermMemoryInjected,
    longTermMemoryBridgePrepared:
      Boolean(longTermMemoryBridgeResult),

    // intent skeleton visibility
    chatIntentMode: chatIntent?.mode || "normal",
    chatIntentDomain: chatIntent?.domain || "unknown",
    chatIntentCandidateSlots: Array.isArray(chatIntent?.candidateSlots)
      ? chatIntent.candidateSlots
      : [],

    // behavior observability
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
}

export default handleChatMessage;