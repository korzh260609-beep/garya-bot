// src/bot/handlers/chat/chatExportFlow.js

import {
  createDocumentOutputFile,
  cleanupDocumentOutputFile,
} from "../../../documents/documentOutputService.js";
import { normalizeFileBaseName, safeText } from "./chatShared.js";

function stripTrailingExtensionPreserveStem(value) {
  const src = safeText(value);
  if (!src) return "";
  return src.replace(/\.[a-z0-9]{1,10}$/i, "").trim();
}

function resolveOriginalDocumentNameCandidate(recentExportCandidate) {
  return (
    safeText(recentExportCandidate?.meta?.originalFileName) ||
    safeText(recentExportCandidate?.meta?.fileName) ||
    safeText(recentExportCandidate?.meta?.title)
  );
}

function resolveExportSuffix(recentExportCandidate) {
  const kind = safeText(recentExportCandidate?.kind).toLowerCase();

  if (kind === "document_summary") return "summary";
  if (kind === "document_current_part") return "part";
  if (kind === "document_assistant_answer") return "answer";

  return "";
}

function buildExportBaseNameFromOriginalDocument(recentExportCandidate) {
  const originalName = resolveOriginalDocumentNameCandidate(recentExportCandidate);
  if (!originalName) return "";

  const stem = stripTrailingExtensionPreserveStem(originalName);
  const normalizedStem = normalizeFileBaseName(stem);
  if (!normalizedStem) return "";

  const suffix = resolveExportSuffix(recentExportCandidate);
  if (!suffix) return normalizedStem;

  return normalizeFileBaseName(`${normalizedStem}_${suffix}`);
}

function resolvePreferredExportBaseName(recentExportCandidate) {
  const originalDocumentBasedName =
    buildExportBaseNameFromOriginalDocument(recentExportCandidate);

  if (originalDocumentBasedName) {
    return originalDocumentBasedName;
  }

  const candidateBaseName = normalizeFileBaseName(
    recentExportCandidate?.baseName ||
      (recentExportCandidate?.kind === "document" ? "document" : "assistant_reply")
  );

  if (candidateBaseName) {
    return candidateBaseName;
  }

  return "document";
}

export function buildCreatedExportFile({
  recentExportCandidate,
  requestedFormat,
}) {
  const baseName = resolvePreferredExportBaseName(recentExportCandidate);

  return createDocumentOutputFile({
    text: recentExportCandidate?.text || "",
    baseName,
    format: requestedFormat,
  });
}

export async function sendCreatedExportFile({
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

export default {
  buildCreatedExportFile,
  sendCreatedExportFile,
};
