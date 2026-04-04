// src/bot/handlers/chat/chatExportFlow.js

import {
  createDocumentOutputFile,
  cleanupDocumentOutputFile,
} from "../../../documents/documentOutputService.js";
import { normalizeFileBaseName } from "./chatShared.js";

export function buildCreatedExportFile({
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