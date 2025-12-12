// src/media/fileIntake.js
// ==================================================
// FILE-INTAKE V1 / 7F.1 — download file (Skeleton)
// + 7F.3 — process file (routing + stubs)
// ==================================================
//
// Что делает файл сейчас:
// 1) Определяет вложение из Telegram msg
// 2) Скачивает файл по file_id
// 3) Роутит обработку по kind (photo/document/audio/voice/video) — пока заглушки
// 4) Возвращает processedText для памяти/ИИ (без Vision/OCR/STT пока)
//
// OCR / STT / parsing — БУДЕТ ПОЗЖЕ (7F.4+)

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
    };
  }

  return null;
}

// ==================================================
// === STEP 2: DOWNLOAD FILE (7F.1)
// ==================================================
export async function downloadTelegramFile(botToken, fileId) {
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  ensureTmpDir();

  // 1) getFile
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const metaJson = await metaRes.json();

  if (!metaJson.ok) {
    throw new Error("Telegram getFile failed");
  }

  const filePath = metaJson.result.file_path;

  // 2) download
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const fileName = path.basename(filePath);
  const localPath = path.join(TMP_DIR, fileName);

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error("File download failed");
  }

  const buffer = await fileRes.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));

  return {
    localPath,
    fileName,
    size: buffer.byteLength,
    telegramPath: filePath,
  };
}

// ==================================================
// === STEP 3: COMBINED HELPER
// ==================================================
export async function intakeAndDownloadIfNeeded(msg, botToken) {
  const summary = summarizeMediaAttachment(msg);
  if (!summary) return null;

  const downloaded = await downloadTelegramFile(botToken, summary.fileId);

  return {
    ...summary,
    downloaded,
  };
}

// ==================================================
// === 7F.3 PROCESS FILE (routing + stubs)
// ==================================================

function safeBasename(p) {
  if (!p) return "";
  try {
    return path.basename(String(p));
  } catch {
    return "";
  }
}

async function processPhoto(intake) {
  const fileName = intake?.downloaded?.fileName || safeBasename(intake?.downloaded?.localPath);
  const w = intake?.width ?? null;
  const h = intake?.height ?? null;

  return {
    ok: true,
    kind: "photo",
    processedText: `Фото получено (file=${fileName}${w && h ? `, ${w}x${h}` : ""}). Анализ изображения будет добавлен на следующем этапе (Vision/OCR).`,
    meta: { fileName, width: w, height: h },
  };
}

async function processDocument(intake) {
  const fileName =
    intake?.fileName ||
    intake?.downloaded?.fileName ||
    safeBasename(intake?.downloaded?.localPath);

  const mimeType = intake?.mimeType || null;

  return {
    ok: true,
    kind: "document",
    processedText: `Документ получен (file=${fileName}${mimeType ? `, mime=${mimeType}` : ""}). Парсинг PDF/DOCX будет добавлен на следующем этапе.`,
    meta: { fileName, mimeType },
  };
}

async function processAudio(intake) {
  const fileName =
    intake?.downloaded?.fileName || safeBasename(intake?.downloaded?.localPath);
  const duration = intake?.duration ?? null;

  return {
    ok: true,
    kind: "audio",
    processedText: `Аудио получено (file=${fileName}${duration ? `, ${duration}s` : ""}). Расшифровка (STT/Whisper) будет добавлена на следующем этапе.`,
    meta: { fileName, duration },
  };
}

async function processVoice(intake) {
  const fileName =
    intake?.downloaded?.fileName || safeBasename(intake?.downloaded?.localPath);
  const duration = intake?.duration ?? null;

  return {
    ok: true,
    kind: "voice",
    processedText: `Голосовое получено (file=${fileName}${duration ? `, ${duration}s` : ""}). Расшифровка (STT/Whisper) будет добавлена на следующем этапе.`,
    meta: { fileName, duration },
  };
}

async function processVideo(intake) {
  const fileName =
    intake?.downloaded?.fileName || safeBasename(intake?.downloaded?.localPath);
  const duration = intake?.duration ?? null;
  const w = intake?.width ?? null;
  const h = intake?.height ?? null;

  return {
    ok: true,
    kind: "video",
    processedText: `Видео получено (file=${fileName}${duration ? `, ${duration}s` : ""}${w && h ? `, ${w}x${h}` : ""}). Извлечение аудио/кадров будет добавлено позже.`,
    meta: { fileName, duration, width: w, height: h },
  };
}

/**
 * Единая точка 7F.3:
 * Принимает intake-объект (уже скачанный файл) и возвращает processedText.
 */
export async function processIncomingFile(intake) {
  if (!intake) return null;

  const kind = intake.kind;

  try {
    if (kind === "photo") return await processPhoto(intake);
    if (kind === "document") return await processDocument(intake);
    if (kind === "audio") return await processAudio(intake);
    if (kind === "voice") return await processVoice(intake);
    if (kind === "video") return await processVideo(intake);

    return {
      ok: true,
      kind: kind || "unknown",
      processedText: `Вложение получено (kind=${kind || "unknown"}). Обработка будет добавлена позже.`,
      meta: {},
    };
  } catch (e) {
    return {
      ok: false,
      kind: kind || "unknown",
      processedText: `Вложение получено, но обработка не удалась (kind=${kind || "unknown"}).`,
      error: e?.message || String(e),
      meta: {},
    };
  }
}
