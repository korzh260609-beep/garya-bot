// src/media/fileIntake.js
// ==================================================
// FILE-INTAKE V1 / 7F.1–7F.4 — Skeleton + Image Stub
// ==================================================
//
// Сейчас:
// 1) Определяет вложение из Telegram msg (summary)
// 2) Умеет скачать файл по file_id (download)
// 3) Даёт "STUB" обработку: фото/документ/аудио — понятный текст
//
// OCR / STT / parsing — будет позже (7F.4+ и 8F.*)

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// ==================================================
// === CONFIG
// ==================================================
const TMP_DIR = path.resolve(process.cwd(), "tmp", "media");

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ==================================================
// === STEP 1: SUMMARY
// ==================================================
export function summarizeMediaAttachment(msg) {
  if (!msg || typeof msg !== "object") return null;

  const chatId = msg.chat?.id ?? null;
  const messageId = msg.message_id ?? null;

  // PHOTO
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    const photo = msg.photo[msg.photo.length - 1];
    return {
      kind: "photo",
      chatId,
      messageId,
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      width: photo.width,
      height: photo.height,
      fileSize: photo.file_size,
      caption: msg.caption || null,
    };
  }

  // DOCUMENT
  if (msg.document) {
    const d = msg.document;
    return {
      kind: "document",
      chatId,
      messageId,
      fileId: d.file_id,
      fileUniqueId: d.file_unique_id,
      fileName: d.file_name || null,
      mimeType: d.mime_type || null,
      fileSize: d.file_size,
      caption: msg.caption || null,
    };
  }

  // AUDIO
  if (msg.audio) {
    const a = msg.audio;
    return {
      kind: "audio",
      chatId,
      messageId,
      fileId: a.file_id,
      fileUniqueId: a.file_unique_id,
      mimeType: a.mime_type || null,
      fileSize: a.file_size,
      duration: a.duration,
      title: a.title || null,
      performer: a.performer || null,
      caption: msg.caption || null,
    };
  }

  // VOICE
  if (msg.voice) {
    const v = msg.voice;
    return {
      kind: "voice",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      duration: v.duration,
      caption: msg.caption || null,
    };
  }

  // VIDEO
  if (msg.video) {
    const v = msg.video;
    return {
      kind: "video",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      width: v.width,
      height: v.height,
      duration: v.duration,
      caption: msg.caption || null,
    };
  }

  return null;
}

// ==================================================
// === STEP 2: DOWNLOAD FILE (7F.1)
// ==================================================
export async function downloadTelegramFile(botToken, fileId) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  if (!fileId) throw new Error("fileId is missing");

  ensureTmpDir();

  // 1) getFile
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(
      fileId
    )}`
  );
  const metaJson = await metaRes.json();

  if (!metaJson.ok || !metaJson.result?.file_path) {
    throw new Error("Telegram getFile failed");
  }

  const telegramPath = metaJson.result.file_path;

  // 2) download
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;
  const fileName = path.basename(telegramPath);
  const localPath = path.join(TMP_DIR, fileName);

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) throw new Error("File download failed");

  const buffer = await fileRes.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));

  return {
    localPath,
    fileName,
    size: buffer.byteLength,
    telegramPath,
  };
}

// ==================================================
// === STEP 3: COMBINED HELPER (optional)
// ==================================================
export async function intakeAndDownloadIfNeeded(msg, botToken) {
  const summary = summarizeMediaAttachment(msg);
  if (!summary) return null;

  // На текущем этапе скачиваем всё (упрощённо)
  const downloaded = await downloadTelegramFile(botToken, summary.fileId);

  return {
    ...summary,
    downloaded,
  };
}

// ==================================================
// === STEP 4: STUB PROCESSORS (7F.4)
// ==================================================
function buildStubMessage(summary) {
  if (!summary) return null;

  if (summary.kind === "photo") {
    return (
      `📸 Фото получено.\n` +
      `OCR/Vision анализ будет добавлен на следующем этапе.\n` +
      `Если нужно — напиши, что именно искать на фото (текст, объекты, детали).`
    );
  }

  if (summary.kind === "document") {
    const name = summary.fileName ? ` (${summary.fileName})` : "";
    const mime = summary.mimeType ? `, mime=${summary.mimeType}` : "";
    return (
      `📄 Документ получен${name}${mime}.\n` +
      `Парсинг PDF/DOCX будет добавлен на следующем этапе.\n` +
      `Если нужно сейчас — вставь сюда текст/ключевые фрагменты.`
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

/**
 * Главный хелпер для index.js:
 * - если у пользователя НЕТ текста, но есть медиа → возвращаем "stub-ответ" и запрещаем AI
 * - если текст ЕСТЬ → разрешаем AI (пока без парсинга), добавляем приписку к тексту
 */
export function buildEffectiveUserTextAndDecision(userText, mediaSummary) {
  const trimmed = safeStr(userText).trim();
  const hasText = Boolean(trimmed);

  if (!mediaSummary) {
    return {
      effectiveUserText: trimmed,
      shouldCallAI: hasText, // если пусто — нечего делать
      directReplyText: hasText ? null : "Напиши текстом, что нужно сделать.",
    };
  }

  const stub = buildStubMessage(mediaSummary);

  // 1) Нет текста → отвечаем stub-ом и НЕ зовём ИИ
  if (!hasText) {
    return {
      effectiveUserText: "",
      shouldCallAI: false,
      directReplyText: stub,
    };
  }

  // 2) Есть текст + медиа → ИИ можно, но честно сообщаем, что парсинга пока нет
  const mediaNote = (() => {
    if (mediaSummary.kind === "photo") return "Вложение: фото (OCR/Vision пока не активен).";
    if (mediaSummary.kind === "document")
      return `Вложение: документ (${mediaSummary.fileName || "file"}) (парсинг пока не активен).`;
    if (mediaSummary.kind === "voice") return "Вложение: голосовое (STT пока не активен).";
    if (mediaSummary.kind === "audio") return "Вложение: аудио (STT пока не активен).";
    if (mediaSummary.kind === "video") return "Вложение: видео (анализ пока не активен).";
    return "Вложение: файл (анализ пока не активен).";
  })();

  return {
    effectiveUserText: `${trimmed}\n\n(${mediaNote})`,
    shouldCallAI: true,
    directReplyText: null,
  };
}
