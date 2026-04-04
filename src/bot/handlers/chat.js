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
import { resolveRecentDocumentEstimateCandidate } from "./chat/documentEstimateBridge.js";
import { resolveDocumentEstimateClarification } from "./chat/documentEstimateClarificationResolver.js";
import { resolveDocumentEstimateFollowUp } from "./chat/documentEstimateFollowUpResolver.js";
import { resolveDocumentEstimateCorrection } from "./chat/documentEstimateCorrectionResolver.js";
import { saveActiveDocumentContext } from "./chat/activeDocumentContextCache.js";
import {
  saveActiveEstimateContext,
  getActiveEstimateContext,
} from "./chat/activeEstimateContextCache.js";
import { saveActiveDocumentExportTarget } from "./chat/activeDocumentExportTargetCache.js";
import { saveActiveExportSource } from "./chat/activeExportSourceCache.js";

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

function normalizeDocumentExportTarget(value) {
  const src = safeText(value).toLowerCase();

  if (src === "summary") return "summary";
  if (src === "full_text") return "full_text";
  if (src === "current_part") return "current_part";
  if (src === "assistant_answer_about_document") {
    return "assistant_answer_about_document";
  }

  return "";
}

function isDocumentRelatedSourceKind(value) {
  const src = safeText(value).toLowerCase();
  return src === "document";
}

function saveExportSourceContext({
  chatId,
  sourceKind,
  chatIdStr,
  messageId,
  reason,
}) {
  const normalizedSourceKind = normalizePreferredExportKind(sourceKind);
  if (!normalizedSourceKind) return null;

  return saveActiveExportSource({
    chatId,
    sourceKind: normalizedSourceKind,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "active_export_source"),
    },
  });
}

function saveDocumentExportTargetContext({
  chatId,
  target,
  chatIdStr,
  messageId,
  reason,
}) {
  const normalizedTarget = normalizeDocumentExportTarget(target);
  if (!normalizedTarget) return null;

  return saveActiveDocumentExportTarget({
    chatId,
    target: normalizedTarget,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "document_export_target_active"),
    },
  });
}

function hydrateRecentRuntimeDocumentIntoCaches({
  chatId,
  chatIdStr,
  messageId,
  FileIntake,
}) {
  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  if (!getRecentDocumentSessionCache) return null;

  const recentRuntimeDocument = getRecentDocumentSessionCache(chatId);
  if (!recentRuntimeDocument?.text) return null;

  saveRecentDocumentForExport({
    chatId,
    text: recentRuntimeDocument.text,
    baseName:
      recentRuntimeDocument?.fileName ||
      recentRuntimeDocument?.title ||
      "document_context",
    meta: {
      source: "document_runtime_text_hydrated",
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
    text: recentRuntimeDocument?.text || "",
    source: "runtime_document_session",
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
    reason: "runtime_document_session",
  });

  return recentRuntimeDocument;
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

function buildEstimateReplyText(estimate) {
  const fileName = safeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0);
  const charCount = Number(estimate?.charCount || 0);
  const chunkSize = Number(estimate?.chunkSize || 0);
  const parts = Array.isArray(estimate?.parts) ? estimate.parts : [];

  const approxInputTokens = Math.ceil(charCount / 4);
  const largestPart = parts.reduce(
    (max, part) => {
      const current = Number(part?.charCount || 0);
      return current > max.charCount
        ? { partNumber: Number(part?.partNumber || 0), charCount: current }
        : max;
    },
    { partNumber: 0, charCount: 0 }
  );

  const lines = [];

  if (chunkCount <= 1) {
    lines.push(
      `Если вывести ${fileName} в чат, он поместится примерно в 1 сообщение.`
    );
  } else {
    lines.push(
      `Если вывести ${fileName} в чат, получится примерно ${chunkCount} частей.`
    );
  }

  if (chunkSize > 0 && charCount > 0) {
    lines.push(
      `Основа оценки: около ${charCount} символов текста при лимите ~${chunkSize} символов на часть.`
    );
    lines.push(`Это примерно ~${approxInputTokens} токенов текста.`);
  }

  if (largestPart.charCount > 0) {
    lines.push(
      `Самая большая часть: №${largestPart.partNumber}, около ${largestPart.charCount} символов.`
    );
  }

  if (chunkCount <= 2) {
    lines.push(`Практичнее вывести в чат.`);
  } else {
    lines.push(`Практичнее отдать файлом, а не длинной серией сообщений.`);
  }

  if (parts.length > 0) {
    lines.push("");
    lines.push("Примерно по частям:");

    for (const part of parts.slice(0, 6)) {
      const partNumber = Number(part?.partNumber || 0);
      const partCharCount = Number(part?.charCount || 0);
      const startsWith = safeText(part?.startsWith || "");

      let line = `- Часть ${partNumber}: ~${partCharCount} символов`;
      if (startsWith) {
        line += `, начинается с: "${startsWith}"`;
      }
      lines.push(line);
    }

    if (parts.length > 6) {
      lines.push(`- ... ещё ${parts.length - 6} частей`);
    }
  }

  return lines.join("\n").trim();
}

function buildEstimateFollowUpReplyText(record, requestedFocus = "general_estimate") {
  const estimate = record?.estimate || null;
  if (!estimate) return "";

  const fileName = safeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0);
  const charCount = Number(estimate?.charCount || 0);
  const chunkSize = Number(estimate?.chunkSize || 0);
  const approxInputTokens = Math.ceil(charCount / 4);
  const parts = Array.isArray(estimate?.parts) ? estimate.parts : [];

  const largestPart = parts.reduce(
    (max, part) => {
      const current = Number(part?.charCount || 0);
      return current > max.charCount
        ? { partNumber: Number(part?.partNumber || 0), charCount: current }
        : max;
    },
    { partNumber: 0, charCount: 0 }
  );

  if (requestedFocus === "tokens") {
    return `Для ${fileName} это примерно ~${approxInputTokens} токенов текста. Оценка грубая: считаю примерно 1 токен ≈ 4 символа.`;
  }

  if (requestedFocus === "chars") {
    if (chunkSize > 0) {
      return `В ${fileName} около ${charCount} символов текста. При лимите ~${chunkSize} символов на часть это и даёт примерно ${chunkCount} частей.`;
    }
    return `В ${fileName} около ${charCount} символов текста.`;
  }

  if (requestedFocus === "largest_part") {
    if (largestPart.charCount > 0) {
      return `Самая большая часть у ${fileName} — №${largestPart.partNumber}, около ${largestPart.charCount} символов.`;
    }
    return `Не вижу достаточно данных по частям, чтобы уверенно назвать самую большую часть у ${fileName}.`;
  }

  if (requestedFocus === "file_vs_chat") {
    if (chunkCount <= 2) {
      return `Для ${fileName} выгоднее чат: частей мало, читать будет проще прямо в переписке.`;
    }
    return `Для ${fileName} выгоднее файл: частей около ${chunkCount}, длинная серия сообщений будет менее удобной.`;
  }

  if (requestedFocus === "chunk_count") {
    if (chunkCount <= 1) {
      return `Если выводить ${fileName} в чат, это примерно 1 сообщение.`;
    }
    return `Если выводить ${fileName} в чат, получится примерно ${chunkCount} частей.`;
  }

  if (requestedFocus === "parts_overview") {
    if (!parts.length) {
      return `По ${fileName} вижу общую оценку, но детальная разбивка по частям сейчас недоступна.`;
    }

    const lines = [`По ${fileName} примерно ${chunkCount} частей.`];

    for (const part of parts.slice(0, 6)) {
      lines.push(
        `- Часть ${Number(part?.partNumber || 0)}: ~${Number(part?.charCount || 0)} символов`
      );
    }

    if (parts.length > 6) {
      lines.push(`- ... ещё ${parts.length - 6} частей`);
    }

    return lines.join("\n").trim();
  }

  return buildEstimateReplyText(estimate);
}

function saveSuccessfulEstimateContext({
  chatId,
  estimate,
  chatIdStr,
  messageId,
  reason,
}) {
  if (!estimate?.ok) return null;

  return saveActiveEstimateContext({
    chatId,
    estimate,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "document_chat_estimate"),
    },
  });
}

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
      await saveAssistantEarlyReturn(question, "document_estimate_clarification_repeat");
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
      await saveAssistantEarlyReturn(text, "document_estimate_no_recent_document");
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

async function tryHandleEstimateCorrection({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
  if (!activeEstimate?.estimate?.ok) {
    return { handled: false };
  }

  const recentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  if (!recentEstimateCandidate?.ok) {
    return { handled: false };
  }

  const resolved = await resolveDocumentEstimateCorrection({
    callAI,
    userText,
    currentEstimateFileName: activeEstimate?.estimate?.fileName || "",
    recentDocumentFileName: recentEstimateCandidate?.fileName || "",
    hasActiveEstimate: true,
    hasRecentDocumentCandidate: true,
  });

  if (!resolved?.isEstimateCorrection) {
    return { handled: false };
  }

  if (resolved?.needsClarification) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Уточни, какой именно недавний документ нужно взять для оценки?";
    await saveAssistantEarlyReturn(
      question,
      "document_estimate_correction_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  if (!resolved?.shouldRebindToRecentDocument) {
    return { handled: false };
  }

  saveSuccessfulEstimateContext({
    chatId: msg?.chat?.id ?? null,
    estimate: recentEstimateCandidate,
    chatIdStr,
    messageId,
    reason: "document_estimate_rebound_to_recent_document",
  });

  const text = buildEstimateReplyText(recentEstimateCandidate);
  await saveAssistantEarlyReturn(text, "document_chat_estimate_rebound");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    estimateSource: recentEstimateCandidate?.source || "unknown",
  };
}

async function tryHandleActiveEstimateFollowUp({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const activeEstimate = getActiveEstimateContext(msg?.chat?.id ?? null);
  if (!activeEstimate?.estimate?.ok) {
    return { handled: false };
  }

  const resolved = await resolveDocumentEstimateFollowUp({
    callAI,
    userText,
    estimateContext: activeEstimate,
  });

  if (!resolved?.isFollowUpToLastEstimate) {
    return { handled: false };
  }

  if (resolved?.needsClarification) {
    const question =
      safeText(resolved?.clarificationQuestion) ||
      "Уточни, что именно по последней оценке тебя интересует?";

    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_estimate_followup_detail",
      question,
      payload: {
        requestedFocus:
          safeText(resolved?.requestedFocus).toLowerCase() || "general_estimate",
      },
    });

    await saveAssistantEarlyReturn(
      question,
      "document_estimate_followup_clarification"
    );
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  const text = buildEstimateFollowUpReplyText(
    activeEstimate,
    resolved?.requestedFocus || "general_estimate"
  );

  if (!text) {
    return { handled: false };
  }

  await saveAssistantEarlyReturn(text, "document_estimate_followup");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    requestedFocus: resolved?.requestedFocus || "general_estimate",
  };
}

async function tryHandleDocumentChatEstimate({
  bot,
  msg,
  chatId,
  trimmed,
  FileIntake,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
}) {
  const userText = safeText(trimmed);
  if (!userText) return { handled: false };

  const currentEstimateCandidate = resolveRecentDocumentEstimateCandidate({
    chatId: msg?.chat?.id ?? null,
    FileIntake,
  });

  const estimateIntent = await resolveDocumentChatEstimateIntent({
    callAI,
    userText,
    hasRecentDocument: Boolean(currentEstimateCandidate?.ok),
  });

  if (!estimateIntent?.isEstimateIntent) {
    return { handled: false };
  }

  if (!currentEstimateCandidate?.ok) {
    const question = "О каком недавнем документе идёт речь?";
    savePendingClarification({
      chatId: msg?.chat?.id ?? null,
      kind: "document_estimate_source",
      question,
      payload: {},
    });
    await saveAssistantEarlyReturn(question, "document_estimate_clarification");
    await bot.sendMessage(chatId, question);
    return { handled: true };
  }

  saveSuccessfulEstimateContext({
    chatId: msg?.chat?.id ?? null,
    estimate: currentEstimateCandidate,
    chatIdStr,
    messageId,
    reason: "document_chat_estimate_direct",
  });

  const text = buildEstimateReplyText(currentEstimateCandidate);

  await saveAssistantEarlyReturn(text, "document_chat_estimate");
  await bot.sendMessage(chatId, text);
  return {
    handled: true,
    estimateSource: currentEstimateCandidate?.source || "unknown",
  };
}

async function tryHandleRecentExport({
  bot,
  msg,
  chatId,
  trimmed,
  saveAssistantEarlyReturn,
  callAI,
  chatIdStr,
  messageId,
}) {
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
    saveExportSourceContext({
      chatId: msg?.chat?.id ?? null,
      sourceKind: "document",
      chatIdStr,
      messageId,
      reason: "document_export_requested",
    });

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

    const normalizedDocumentTarget = normalizeDocumentExportTarget(
      exportTarget?.target || "auto"
    );
    if (normalizedDocumentTarget) {
      saveDocumentExportTargetContext({
        chatId: msg?.chat?.id ?? null,
        target: normalizedDocumentTarget,
        chatIdStr,
        messageId,
        reason: "document_export_target_resolved",
      });
    }

    recentExportCandidate = getDocumentExportTargetCandidate(
      msg?.chat?.id ?? null,
      exportTarget?.target || "auto"
    );
  } else {
    if (explicitKind === "assistant_reply" || explicitKind === "auto") {
      saveExportSourceContext({
        chatId: msg?.chat?.id ?? null,
        sourceKind: "assistant_reply",
        chatIdStr,
        messageId,
        reason:
          explicitKind === "assistant_reply"
            ? "assistant_reply_export_requested"
            : "auto_export_requested",
      });
    }

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

  const exportResult = await tryHandleRecentExport({
    bot,
    msg,
    chatId,
    trimmed,
    saveAssistantEarlyReturn,
    callAI,
    chatIdStr,
    messageId,
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