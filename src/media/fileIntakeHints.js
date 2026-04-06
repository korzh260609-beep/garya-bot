// src/media/fileIntakeHints.js
// ==================================================
// FILE-INTAKE USER HINTS / STUBS
// Purpose:
// - fallback stub messages
// - OCR / visible facts user hints
// - document user hint
// ==================================================

import { safeStr } from "./fileIntakeCore.js";

export function buildStubMessage(summary) {
  if (!summary) return null;

  if (summary.kind === "photo") {
    return (
      `📸 Фото получено.\n` +
      `OCR/Vision анализ пока недоступен.\n` +
      `Если нужно — напиши, что именно искать на фото (текст, объекты, детали).`
    );
  }

  if (summary.kind === "document") {
    const name = summary.fileName ? ` (${summary.fileName})` : "";
    const mime = summary.mimeType ? `, mime=${summary.mimeType}` : "";
    return (
      `📄 Документ получен${name}${mime}.\n` +
      `Извлечение текста доступно только для части форматов на текущем этапе.\n` +
      `PDF/DOCX парсер будет добавлен отдельным шагом.`
    );
  }

  if (summary.kind === "voice") {
    return (
      `🎙 Голосовое сообщение получено.\n` +
      `STT (распознавание речи) будет добавлено на следующем этапе.\n` +
      `Если хочешь — напиши кратко, о чём голосовое.`
    );
  }

  if (summary.kind === "audio") {
    return (
      `🎵 Аудио получено.\n` +
      `Транскрибация/разбор аудио будет добавлен на следующем этапе.`
    );
  }

  if (summary.kind === "video") {
    return (
      `🎬 Видео получено.\n` +
      `Извлечение кадров/аудио + анализ будет добавлен на следующем этапе.`
    );
  }

  return `📎 Вложение получено.`;
}

export function buildVisionHintForUser(visionResult) {
  if (!visionResult) {
    return "📷 Vision/OCR: результата нет.";
  }

  if (visionResult.ok === true) {
    const extracted = safeStr(visionResult.text).trim();

    if (extracted) {
      return `📷 OCR результат:\n\n${extracted}`;
    }

    return (
      `📷 OCR выполнен, но текст не извлечён.\n` +
      `Возможно, на фото мало читаемого текста или он слишком нечёткий.`
    );
  }

  return (
    `📷 OCR сейчас не сработал.\n` +
    `Причина: ${visionResult.error || "vision_unavailable"}.\n` +
    `SG продолжает работать в безопасном fallback-режиме.`
  );
}

export function buildVisibleFactsHintForUser(factsResult) {
  if (!factsResult) {
    return "👁 Видимые факты: результата нет.";
  }

  if (factsResult.ok === true) {
    const facts = safeStr(factsResult.text).trim();

    if (facts) {
      return `👁 Что видно на фото:\n\n${facts}`;
    }

    return (
      `👁 Vision-анализ выполнен, но кратких видимых фактов не извлечено.\n` +
      `Возможно, изображение слишком неясное или деталей недостаточно.`
    );
  }

  return (
    `👁 Vision-описание сейчас не сработало.\n` +
    `Причина: ${factsResult.error || "vision_facts_unavailable"}.`
  );
}

export function buildCombinedDirectHint({ visionResult, factsResult }) {
  const ocrText = safeStr(visionResult?.text).trim();
  const factsText = safeStr(factsResult?.text).trim();

  if (ocrText && factsText) {
    return `📷 OCR результат:\n\n${ocrText}\n\n👁 Что видно на фото:\n\n${factsText}`;
  }

  if (ocrText) {
    return buildVisionHintForUser(visionResult);
  }

  if (factsText) {
    return buildVisibleFactsHintForUser(factsResult);
  }

  if (visionResult && visionResult.ok === false) {
    return buildVisionHintForUser(visionResult);
  }

  if (factsResult && factsResult.ok === false) {
    return buildVisibleFactsHintForUser(factsResult);
  }

  return null;
}

export function buildDocumentHintForUser(documentResult, intake = null) {
  const fileName =
    intake?.downloaded?.fileName ||
    intake?.fileName ||
    "file";

  if (!documentResult) {
    return `📄 Документ ${fileName} обработан без результата.`;
  }

  if (documentResult.ok === true) {
    const extracted = safeStr(documentResult.text).trim();

    if (extracted) {
      return (
        `📄 Документ ${fileName} обработан.\n` +
        `Сейчас дам только общий смысл, а не весь текст целиком.\n` +
        `Если нужен полный текст — напиши: покажи весь файл`
      );
    }

    return (
      `📄 Документ ${fileName} обработан, но текст не извлечён.\n` +
      `Возможно, файл пустой или формат пока поддерживается ограниченно.`
    );
  }

  if (
    documentResult.error === "pdf_parser_not_available_current_stage" ||
    documentResult.error === "docx_parser_not_available_current_stage" ||
    documentResult.error === "doc_parser_not_available_current_stage"
  ) {
    return (
      `📄 Документ ${fileName} получен.\n` +
      `Для этого формата реальный parser ещё не подключён на текущем этапе.\n` +
      `Сейчас доступны текстовые форматы и базовый RTF.`
    );
  }

  return (
    `📄 Извлечение текста из ${fileName} сейчас не сработало.\n` +
    `Причина: ${documentResult.error || "document_extract_unavailable"}.`
  );
}

export default {
  buildStubMessage,
  buildVisionHintForUser,
  buildVisibleFactsHintForUser,
  buildCombinedDirectHint,
  buildDocumentHintForUser,
};