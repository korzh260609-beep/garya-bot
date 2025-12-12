// src/media/fileIntake.js
// ==================================================
// FILE-INTAKE V1 / 7F.1–7F.4 — Skeleton
// ==================================================
//
// Что есть сейчас:
// 7F.1 download file (по необходимости)
// 7F.2 detect type
// 7F.3 process file (routing)
// 7F.4 OCR img — SKELETON (заглушка, без Vision)
//
//
// ВАЖНО: этот файл НЕ вызывает ИИ и НЕ делает OCR реально.
// Он возвращает "userFacingText" (одну строку/сообщение для пользователя)
// и "effectiveUserText" (текст, который можно передавать в ИИ-чат, если нужно).
//
// Цель: чтобы бот НЕ писал "не могу просмотреть", а честно говорил:
// - Фото принято, OCR будет позже
// - PDF принят, парсинг будет позже
//
// + Не светим localPath в ответах пользователю.

import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// ==================================================
// === CONFIG
// ==================================================
const TMP_DIR = path.resolve(process.cwd(), "tmp", "media");

// Ограничение на скачивание (защита от мусора/спама)
const MAX_DOWNLOAD_BYTES = Number(process.env.FILE_INTAKE_MAX_BYTES || 15 * 1024 * 1024); // 15MB

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
}

function safeStr(v) {
  return typeof v === "string" ? v : "";
}

function truncate(s, n = 800) {
  const str = safeStr(s);
  if (str.length <= n) return str;
  return str.slice(0, n) + "…";
}

// ==================================================
// === STEP A: SUMMARY / DETECT TYPE
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
// === STEP 7F.1: DOWNLOAD FILE (OPTIONAL)
// ==================================================
export async function downloadTelegramFile(botToken, fileId) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  if (!fileId) throw new Error("fileId is missing");

  ensureTmpDir();

  // 1) getFile
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const metaJson = await metaRes.json();

  if (!metaJson.ok) {
    throw new Error(`Telegram getFile failed: ${JSON.stringify(metaJson)}`);
  }

  const telegramPath = metaJson.result.file_path;
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;

  // 2) download
  const fileName = path.basename(telegramPath);
  const localPath = path.join(TMP_DIR, fileName);

  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    throw new Error(`File download failed: HTTP ${fileRes.status}`);
  }

  const ab = await fileRes.arrayBuffer();
  const size = ab.byteLength;

  if (size > MAX_DOWNLOAD_BYTES) {
    throw new Error(`File too large: ${size} bytes (limit ${MAX_DOWNLOAD_BYTES})`);
  }

  fs.writeFileSync(localPath, Buffer.from(ab));

  return {
    // ВАЖНО: localPath НЕ показываем пользователю (только для внутренних модулей)
    localPath,
    fileName,
    size,
    telegramPath,
  };
}

// ==================================================
// === STEP 7F.3: PROCESS FILE (ROUTING)
// ==================================================
function buildUserFacingAck(summary) {
  if (!summary) return null;

  if (summary.kind === "photo") {
    return `✅ Файл принят: photo (${summary.fileId || "?"})`;
  }
  if (summary.kind === "document") {
    const name = summary.fileName ? `file=${summary.fileName}` : "file=document";
    const mime = summary.mimeType ? `, mime=${summary.mimeType}` : "";
    return `✅ Файл принят: document (${name}${mime})`;
  }
  if (summary.kind === "audio") return `✅ Файл принят: audio (${summary.fileId || "?"})`;
  if (summary.kind === "voice") return `✅ Файл принят: voice (${summary.fileId || "?"})`;
  if (summary.kind === "video") return `✅ Файл принят: video (${summary.fileId || "?"})`;

  return `✅ Файл принят: ${summary.kind || "unknown"}`;
}

function processPhotoSkeleton(summary) {
  // 7F.4 OCR img — пока заглушка, без Vision
  const w = summary.width ? ` ${summary.width}x${summary.height}` : "";
  return `📸 Фото получено${w}. OCR/визуальный анализ будет добавлен на следующем этапе.`;
}

function processDocumentSkeleton(summary) {
  const name = summary.fileName ? ` (${summary.fileName})` : "";
  return `📄 Документ получен${name}. Парсинг PDF/DOCX будет добавлен на следующем этапе.`;
}

function processAudioSkeleton() {
  return `🎧 Аудио получено. Расшифровка (STT) будет добавлена на следующем этапе.`;
}

function processVoiceSkeleton() {
  return `🎤 Голосовое получено. Расшифровка (STT) будет добавлена на следующем этапе.`;
}

function processVideoSkeleton() {
  return `🎞 Видео получено. Извлечение аудио/кадров будет добавлено на следующем этапе.`;
}

// Главный процессор: возвращает тексты, НЕ вызывает ИИ
export async function processIncomingFile(msg, botToken, opts = {}) {
  const summary = summarizeMediaAttachment(msg);
  if (!summary) return null;

  const ack = buildUserFacingAck(summary);

  // По умолчанию: НЕ скачиваем автоматически всё подряд.
  // Скачивание включаем точечно (например, для будущего OCR/PDF).
  const shouldDownload = Boolean(opts.download === true);

  let downloaded = null;
  let downloadError = null;

  if (shouldDownload) {
    try {
      downloaded = await downloadTelegramFile(botToken, summary.fileId);
    } catch (e) {
      downloadError = e?.message || String(e);
    }
  }

  let userFacingText = "";
  if (summary.kind === "photo") userFacingText = processPhotoSkeleton(summary);
  else if (summary.kind === "document") userFacingText = processDocumentSkeleton(summary);
  else if (summary.kind === "audio") userFacingText = processAudioSkeleton(summary);
  else if (summary.kind === "voice") userFacingText = processVoiceSkeleton(summary);
  else if (summary.kind === "video") userFacingText = processVideoSkeleton(summary);
  else userFacingText = `Файл получен. Обработка будет добавлена позже.`;

  // ВАЖНО: ошибки скачивания показываем очень мягко (без путей)
  if (downloadError) {
    userFacingText += `\n⚠️ Не удалось скачать файл (внутренняя ошибка).`;
  }

  // effectiveUserText — краткая строка, которую можно вложить в AI-контекст
  // (но если пользователь ничего не написал, лучше НЕ вызывать ИИ вовсе — это уже правка index.js)
  const effectiveUserText = truncate(
    `Attachment: ${summary.kind}. ${userFacingText}`,
    700
  );

  return {
    ok: true,
    summary,
    ack,
    userFacingText,
    effectiveUserText,
    downloaded, // использовать в будущем, НЕ показывать пользователю
  };
}

// ==================================================
// === Helper: build effective user text (text + file)
// ==================================================
export async function buildEffectiveUserText(msg, botToken, opts = {}) {
  const rawText = safeStr(msg?.text || "").trim();

  const fileResult = await processIncomingFile(msg, botToken, opts);
  const hasFile = Boolean(fileResult);

  // Важно: userFacingText отдельно — это то, что мы можем отправить пользователю сразу.
  // effectiveUserText — то, что добавляем в AI messages (если вообще вызываем ИИ).

  let effective = rawText;

  if (!rawText && hasFile) {
    effective = ""; // специально пусто: если нет текста — лучше НЕ звать ИИ (исправим в index.js)
  } else if (rawText && hasFile) {
    effective = `${rawText}\n\n(${fileResult.effectiveUserText})`;
  }

  return {
    rawText,
    hasFile,
    fileResult,
    effectiveText: effective,
  };
}
