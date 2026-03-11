// src/media/fileIntake.js
// ==================================================
// FILE-INTAKE V1 / 7F.1–7F.10 — Skeleton + Logs + Routing Stub
// ==================================================
//
// Сейчас:
// 1) Определяет вложение из Telegram msg (summary)
// 2) Умеет скачать файл по file_id (download)
// 3) Умеет сделать базовый routing/stub (processIncomingFile)
// 4) Даёт расширенные логи внутри intake.meta.logs[] + console.log
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

function nowIso() {
  return new Date().toISOString();
}

function makeMeta() {
  return {
    startedAt: nowIso(),
    logs: [], // { t, level, step, msg, data? }
  };
}

function pushLog(meta, level, step, msg, data = null) {
  const entry = { t: nowIso(), level, step, msg };
  if (data !== null && data !== undefined) entry.data = data;
  if (meta?.logs) meta.logs.push(entry);

  // Дублируем в Render logs (коротко, без мусора)
  try {
    const prefix = `[FileIntake:${level}] ${step}:`;
    if (data) console.log(prefix, msg, data);
    else console.log(prefix, msg);
  } catch (_) {
    // ignore
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
// === STEP 3: COMBINED HELPER (7F.1–7F.3)
// ==================================================
export async function intakeAndDownloadIfNeeded(msg, botToken) {
  const meta = makeMeta();

  const summary = summarizeMediaAttachment(msg);
  if (!summary) {
    pushLog(meta, "info", "summary", "No attachment in message.");
    return null;
  }

  pushLog(meta, "info", "summary", "Attachment summarized.", {
    kind: summary.kind,
    fileId: summary.fileId,
    fileName: summary.fileName || null,
    mimeType: summary.mimeType || null,
    fileSize: summary.fileSize || null,
  });

  // На текущем этапе скачиваем всё (упрощённо)
  const downloaded = await downloadTelegramFile(botToken, summary.fileId);
  pushLog(meta, "info", "download", "Attachment downloaded.", {
    fileName: downloaded.fileName,
    size: downloaded.size,
    localPath: downloaded.localPath,
  });

  return {
    ...summary,
    downloaded,
    meta,
  };
}

// ==================================================
// === STEP 4: STUB MESSAGE (7F.3)
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

// ==================================================
// === STEP 5: PROCESS INCOMING FILE (routing + stub) (7F.3)
// ==================================================
export async function processIncomingFile(intake) {
  const meta = intake?.meta || makeMeta();
  pushLog(meta, "info", "process", "Start processing intake.", {
    kind: intake?.kind,
    fileName: intake?.downloaded?.fileName || intake?.fileName || null,
  });

  // Пока только stub routing (без OCR/STT)
  const stub = buildStubMessage(intake);

  const processedText = (() => {
    if (!intake) return "";
    const kind = intake.kind || "unknown";
    const fileName = intake?.downloaded?.fileName || intake?.fileName || "";
    const mime = intake?.mimeType || "";
    return `File-Intake stub: kind=${kind}; file=${fileName}; mime=${mime || "n/a"}.`;
  })();

  pushLog(meta, "info", "process", "Stub processing complete.", {
    processedText,
  });

  return {
    ok: true,
    processedText,
    directUserHint: stub, // что можно показать пользователю сразу (если нужно)
    meta,
  };
}

// ==================================================
// === STEP 6: EFFECTIVE TEXT + DECISION (7F.9)
// ==================================================
/**
 * CURRENT AUTHORITATIVE AI-FACING POLICY.
 *
 * IMPORTANT:
 * - this function remains the authoritative runtime path for AI-facing
 *   media/text decision semantics in production
 * - do NOT replace it with buildInboundChatPayload.js yet
 * - do NOT import future contract here during skeleton stage
 *
 * BRIDGE NOTE:
 * - authority here applies ONLY to AI-facing semantics
 * - this function is NOT the authority for chat_messages storage semantics
 * - Core storage-facing authority still remains in:
 *   src/core/handleMessage.js -> buildInboundStorageText(...)
 * - semantic divergence between storage and AI-facing text is intentional at current Stage 7B
 * - any unification must happen only in a separate explicit runtime migration step
 *
 * VERIFIED RUNTIME BOUNDARY:
 * - this function decides how chat.js should talk to AI right now
 * - this function does NOT decide how inbound messages are stored in chat_messages
 * - this function does NOT own dedupe semantics
 * - this function does NOT approve contract migration on its own
 *
 * Future migration target:
 * - src/services/chatMemory/buildInboundChatPayload.js
 *
 * But at the current step that file is CONTRACT/SKELETON ONLY and must not
 * change runtime behavior until an explicit migration micro-step is approved.
 *
 * Главный хелпер:
 * - если у пользователя НЕТ текста и НЕТ caption, но есть медиа → возвращаем stub и НЕ зовём AI
 * - если текст есть (включая caption у фото/доков) → зовём AI, но честно сообщаем что парсинга пока нет
 */
export function buildEffectiveUserTextAndDecision(userText, mediaSummary) {
  // ✅ Telegram нюанс: caption — это "текст" для фото/документа
  const trimmedText = safeStr(userText).trim();
  const captionText = safeStr(mediaSummary?.caption).trim();
  const effectiveText = trimmedText || captionText;

  const hasText = Boolean(effectiveText);

  if (!mediaSummary) {
    return {
      effectiveUserText: trimmedText,
      shouldCallAI: hasText,
      directReplyText: hasText ? null : "Напиши текстом, что нужно сделать.",
      decisionMeta: {
        hasText,
        hasMedia: false,
        shouldCallAI: hasText,
        reason: hasText ? "text_only" : "empty",
      },
    };
  }

  const stub = buildStubMessage(mediaSummary);

  // 1) Нет текста (и caption) → stub и НЕ зовём ИИ
  if (!hasText) {
    return {
      effectiveUserText: "",
      shouldCallAI: false,
      directReplyText: stub,
      decisionMeta: {
        hasText,
        hasMedia: true,
        shouldCallAI: false,
        reason: "media_only_no_text",
        kind: mediaSummary.kind,
      },
    };
  }

  // 2) Есть текст + медиа → ИИ можно, но честно сообщаем, что парсинга пока нет
  //
  // IMPORTANT:
  // - returned effectiveUserText below is an AI-facing conversational payload
  // - it is intentionally richer than plain storage-facing content
  // - adding media note here does NOT mean Core storage must store same suffix
  // - this extra note is part of current AI policy, not universal inbound normalization
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
    effectiveUserText: `${effectiveText}\n\n(${mediaNote})`,
    shouldCallAI: true,
    directReplyText: null,
    decisionMeta: {
      hasText,
      hasMedia: true,
      shouldCallAI: true,
      reason: trimmedText ? "text_plus_media" : "caption_plus_media",
      kind: mediaSummary.kind,
    },
  };
}

// ==================================================
// === OPTIONAL: DEBUG FORMATTER (7F.10)
// ==================================================
export function formatFileIntakeLogs(meta, limit = 20) {
  const logs = meta?.logs || [];
  if (!logs.length) return "File-Intake logs: empty.";
  const slice = logs.slice(-toIntOr(limit, 20));
  let out = "🧾 File-Intake logs\n\n";
  for (const l of slice) {
    out += `• ${l.t} [${l.level}] ${l.step}: ${l.msg}\n`;
    if (l.data) out += `  data: ${safeStr(JSON.stringify(l.data)).slice(0, 600)}\n`;
  }
  return out.trim();
}

function toIntOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}