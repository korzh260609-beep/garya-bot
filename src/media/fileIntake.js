// src/media/fileIntake.js
// ==================================================
// STAGE 11F + STAGE 12.4/12.6 — FILE-INTAKE + OCR + VISIBLE FACTS BRIDGE
// 11F.1 download file
// 11F.2 detect type
// 11F.3 process file (routing + stub)
// 11F.9 effectiveUserText
// 11F.10 logs
// 11F.11 DATA LIFECYCLE skeleton
// 11F.12 AI routing rule skeleton
//
// 12.x OCR vision routing/service/provider bridge
// - OCR text extraction
// - visible scene/object facts extraction
// - direct reply for media-only path may use OCR and/or visible facts
//
// 12.x document extract-first bridge
// - text-like document extraction
// - real PDF/DOCX extraction
// - lightweight document structuring
//
// IMPORTANT:
// - media-only path should return real OCR text when available
// - if OCR has no text, visible facts may still help for object questions
// - generic AI is still text-only fallback for media+text flows
// ==================================================

import fs from "fs";
import path from "path";
import { fetchWithTimeout } from "../core/fetchWithTimeout.js";
import {
  getVisionServiceStatus,
  extractTextWithVisionFromIntake,
  extractVisibleFactsWithVisionFromIntake,
  canRunVisionForIntake,
} from "../vision/visionService.js";
import {
  getDocumentTextServiceStatus,
  extractTextFromDocumentIntake,
  canRunDocumentTextForIntake,
} from "../documents/documentTextService.js";

// ==================================================
// === CONFIG
// ==================================================
const TMP_DIR = path.resolve(process.cwd(), "tmp", "media");
const DOCUMENT_REPLY_CHUNK_SIZE = 3200;
const DOCUMENT_SESSION_CACHE = new Map();
const DOCUMENT_SESSION_BIND_WINDOW_MS = 30 * 60 * 1000; // 30 min

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

function nowMs() {
  return Date.now();
}

function makeMeta() {
  return {
    startedAt: nowIso(),
    logs: [],
  };
}

function pushLog(meta, level, step, msg, data = null) {
  const entry = { t: nowIso(), level, step, msg };
  if (data !== null && data !== undefined) entry.data = data;
  if (meta?.logs) meta.logs.push(entry);

  try {
    const prefix = `[FileIntake:${level}] ${step}:`;
    if (data) console.log(prefix, msg, data);
    else console.log(prefix, msg);
  } catch (_) {
    // ignore
  }
}

function toIntOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeCommandText(value) {
  return safeStr(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitTextIntoChunks(text, chunkSize = DOCUMENT_REPLY_CHUNK_SIZE) {
  const src = safeStr(text);
  if (!src) return [];

  const chunks = [];
  let start = 0;

  while (start < src.length) {
    const endLimit = Math.min(start + chunkSize, src.length);

    if (endLimit >= src.length) {
      chunks.push(src.slice(start).trim());
      break;
    }

    let splitAt = src.lastIndexOf("\n\n", endLimit);
    if (splitAt <= start + 400) {
      splitAt = src.lastIndexOf("\n", endLimit);
    }
    if (splitAt <= start + 300) {
      splitAt = src.lastIndexOf(" ", endLimit);
    }
    if (splitAt <= start) {
      splitAt = endLimit;
    }

    chunks.push(src.slice(start, splitAt).trim());
    start = splitAt;
  }

  return chunks.filter(Boolean);
}

function buildDocumentPartReply(cache, partIndex) {
  const chunks = Array.isArray(cache?.chunks) ? cache.chunks : [];
  const total = chunks.length;

  if (!total || partIndex < 0 || partIndex >= total) {
    return null;
  }

  const fileName = safeStr(cache?.fileName || "document");
  const body = safeStr(chunks[partIndex]).trim();
  const currentPart = partIndex + 1;

  const tail =
    currentPart < total
      ? `\n\nНапиши: дальше`
      : "\n\nЭто последняя часть.";

  return `📄 ${fileName}\nЧасть ${currentPart}/${total}\n\n${body}${tail}`;
}

function isDocumentFullTextCommand(value) {
  const text = normalizeCommandText(value);
  if (!text) return false;

  return [
    "покажи весь файл",
    "выдай весь файл",
    "покажи полный файл",
    "покажи весь документ",
    "покажи полный документ",
    "покажи полный текст",
    "выдай полный текст",
    "полный текст",
    "весь файл",
    "весь документ",
  ].includes(text);
}

function isDocumentContinueCommand(value) {
  const text = normalizeCommandText(value);
  if (!text) return false;

  return [
    "дальше",
    "продолжай",
    "еще",
    "ещё",
    "следующая часть",
    "следующий кусок",
    "следующий фрагмент",
  ].includes(text);
}

function safeDocumentMeta(meta = {}) {
  return {
    title: safeStr(meta?.title || "").trim() || null,
    structureVersion: Number(meta?.structureVersion || 0) || null,
    structureSource: safeStr(meta?.structureSource || "").trim() || null,
    stats:
      meta?.stats && typeof meta.stats === "object"
        ? {
            charCount: Number(meta.stats.charCount || 0) || 0,
            wordCount: Number(meta.stats.wordCount || 0) || 0,
            paragraphCount: Number(meta.stats.paragraphCount || 0) || 0,
            blockCount: Number(meta.stats.blockCount || 0) || 0,
            headingCount: Number(meta.stats.headingCount || 0) || 0,
          }
        : null,
    headings: Array.isArray(meta?.headings)
      ? meta.headings.map((item) => ({
          index: Number(item?.index || 0) || 0,
          type: safeStr(item?.type || "").trim() || "heading",
          text: safeStr(item?.text || "").trim(),
        }))
      : [],
  };
}

function buildAutoSummaryRequestText(fileName) {
  const normalizedFileName = safeStr(fileName || "document").trim() || "document";

  return (
    `Сделай ОЧЕНЬ КОРОТКУЮ и полезную сводку документа ${normalizedFileName}. ` +
    `Нужен только общий смысл документа в сжатом виде. ` +
    `Формат ответа: ` +
    `1) одна короткая строка "О чем документ", ` +
    `2) затем 2-4 очень коротких пункта с главным. ` +
    `Без длинного пересказа, без больших абзацев, без воды, без цитирования всего текста. ` +
    `Если данных мало — скажи это коротко. ` +
    `Полный текст НЕ выдавай без отдельного запроса пользователя.`
  );
}

function saveDocumentSessionCache({
  chatId,
  fileName,
  text,
  title = null,
  stats = null,
  headings = [],
  blocks = [],
  structureVersion = null,
  structureSource = null,
}) {
  const key = String(chatId || "").trim();
  const content = safeStr(text).trim();

  if (!key || !content) return null;

  const chunks = splitTextIntoChunks(content, DOCUMENT_REPLY_CHUNK_SIZE);

  const cache = {
    chatId: key,
    fileName: safeStr(fileName || "document"),
    text: content,
    chunks,
    nextChunkIndex: 0,
    createdAt: nowIso(),
    createdAtMs: nowMs(),
    lastUsedAt: nowIso(),
    lastUsedAtMs: nowMs(),
    title: safeStr(title || "").trim() || null,
    stats: stats && typeof stats === "object" ? stats : null,
    headings: Array.isArray(headings) ? headings : [],
    blocks: Array.isArray(blocks) ? blocks : [],
    structureVersion: Number(structureVersion || 0) || null,
    structureSource: safeStr(structureSource || "").trim() || null,
  };

  DOCUMENT_SESSION_CACHE.set(key, cache);
  return cache;
}

function touchDocumentSessionCache(cache) {
  if (!cache || typeof cache !== "object") return;
  cache.lastUsedAt = nowIso();
  cache.lastUsedAtMs = nowMs();
}

export function getDocumentSessionCache(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;
  return DOCUMENT_SESSION_CACHE.get(key) || null;
}

export function getRecentDocumentSessionCache(chatId) {
  const cache = getDocumentSessionCache(chatId);
  if (!cache) return null;

  const lastUsedAtMs = Number(cache?.lastUsedAtMs || cache?.createdAtMs || 0);
  if (!lastUsedAtMs) return null;

  const ageMs = nowMs() - lastUsedAtMs;
  if (ageMs > DOCUMENT_SESSION_BIND_WINDOW_MS) {
    return null;
  }

  return cache;
}

export function shouldBindMessageToRecentDocumentSession(text) {
  const src = safeStr(text).trim();
  if (!src) return false;

  if (src.startsWith("/")) return false;
  if (src.length > 400) return false;

  const compact = normalizeCommandText(src);
  if (!compact) return false;

  if (isDocumentFullTextCommand(compact)) return true;
  if (isDocumentContinueCommand(compact)) return true;

  const hasUrl =
    compact.includes("http://") ||
    compact.includes("https://") ||
    compact.includes("www.");
  if (hasUrl) return false;

  const hasCodeLike =
    compact.includes("{") ||
    compact.includes("}") ||
    compact.includes("[") ||
    compact.includes("]") ||
    compact.includes("```");
  if (hasCodeLike) return false;

  const words = compact.split(" ").filter(Boolean).length;
  if (words <= 14) return true;

  if (compact.endsWith("?") && words <= 24) return true;

  const hasDocumentReference =
    compact.includes("документ") ||
    compact.includes("файл") ||
    compact.includes("текст") ||
    compact.includes("смысл") ||
    compact.includes("суть") ||
    compact.includes("кратко") ||
    compact.includes("summary");

  return hasDocumentReference;
}

export function tryHandleDocumentSessionCommand({ chatId, text }) {
  const cache = getDocumentSessionCache(chatId);
  if (!cache) {
    return {
      handled: false,
      replyText: null,
    };
  }

  if (isDocumentFullTextCommand(text)) {
    touchDocumentSessionCache(cache);
    cache.nextChunkIndex = 1;

    const replyText = buildDocumentPartReply(cache, 0);
    return {
      handled: Boolean(replyText),
      replyText,
    };
  }

  if (isDocumentContinueCommand(text)) {
    touchDocumentSessionCache(cache);

    const nextIndex = Number(cache.nextChunkIndex || 0);

    if (nextIndex >= cache.chunks.length) {
      return {
        handled: true,
        replyText: "Это уже последняя часть документа.",
      };
    }

    const replyText = buildDocumentPartReply(cache, nextIndex);
    cache.nextChunkIndex = nextIndex + 1;

    return {
      handled: Boolean(replyText),
      replyText,
    };
  }

  return {
    handled: false,
    replyText: null,
  };
}

// ==================================================
// === 11F.12 AI ROUTING RULE skeleton
// ==================================================
export function buildSpecializedAIRoutingRule(summary) {
  const kind = summary?.kind || "unknown";

  switch (kind) {
    case "photo":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "vision_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Photo should route to Vision-class handler; current runtime may return OCR and visible facts if provider is active.",
      };

    case "document":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "document_parse_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Document should route to parser/extract-class handler; current runtime may extract text and lightweight structure from supported formats.",
      };

    case "voice":
    case "audio":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "stt_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Voice/audio must go to STT-class handler in future; current runtime allows only text fallback.",
      };

    case "video":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "video_extract_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Video must go to frame/audio extraction handler in future; current runtime allows only text fallback.",
      };

    default:
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "unknown_candidate",
        specializedProviderRequired: false,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Unknown file kind has no active specialized handler; current runtime allows only text fallback.",
      };
  }
}

export function compactRoutingRuleForDebug(rule) {
  return {
    routeVersion: rule?.routeVersion || "n/a",
    kind: rule?.kind || "n/a",
    specializedRoute: rule?.specializedRoute || "n/a",
    specializedProviderRequired: rule?.specializedProviderRequired === true,
    specializedProviderActive: rule?.specializedProviderActive === true,
    genericAiAllowedToSeeBinary: rule?.genericAiAllowedToSeeBinary === true,
    genericAiMode: rule?.genericAiMode || "n/a",
    fallbackMode: rule?.fallbackMode || "n/a",
  };
}

// ==================================================
// === 11F.11 DATA LIFECYCLE skeleton
// ==================================================
function buildRetentionPolicySkeleton(kind = "unknown") {
  return {
    enabled: false,
    policyVersion: 1,
    retentionDays: null,
    archiveEnabled: false,
    binaryPersistenceAllowed: false,
    cleanupMode: "tmp_delete_after_processing",
    notes: `Retention not active yet for kind=${kind}.`,
  };
}

function buildDataLifecycleSkeleton(summary) {
  const kind = summary?.kind || "unknown";

  return {
    schemaVersion: 1,
    lifecycleVersion: "11F.11-skeleton",
    sourceType: "telegram_media",
    kind,
    createdAt: nowIso(),

    identity: {
      chatId: summary?.chatId ?? null,
      messageId: summary?.messageId ?? null,
      fileId: summary?.fileId || null,
      fileUniqueId: summary?.fileUniqueId || null,
    },

    descriptor: {
      fileName: summary?.fileName || null,
      mimeType: summary?.mimeType || null,
      fileSize: summary?.fileSize ?? null,
      width: summary?.width ?? null,
      height: summary?.height ?? null,
      duration: summary?.duration ?? null,
      captionPresent: Boolean(summary?.caption),
    },

    storage: {
      binaryPersisted: false,
      persistedBinaryLocation: null,
      tempLocalPath: null,
      tempExists: false,
      extractedTextPersisted: false,
      extractedTextLocation: null,
      structuredDataPersisted: false,
      structuredDataLocation: null,
      policy: "meta_only_no_binary_persistence",
    },

    routing: buildSpecializedAIRoutingRule(summary),

    processing: {
      summaryDone: false,
      downloaded: false,
      processed: false,
      cleanupAttempted: false,
      cleanupRemoved: false,
      cleanupReason: null,

      visionAttempted: false,
      visionOk: false,
      visionReason: null,

      factsAttempted: false,
      factsOk: false,
      factsReason: null,
    },

    retention: buildRetentionPolicySkeleton(kind),
  };
}

export function buildFileLifecycleRecord(msg) {
  const summary = summarizeMediaAttachment(msg);
  if (!summary) return null;
  return buildDataLifecycleSkeleton(summary);
}

export function compactLifecycleForDebug(lifecycle) {
  return {
    lifecycleVersion: lifecycle?.lifecycleVersion || "n/a",
    kind: lifecycle?.kind || "n/a",
    binaryPersisted: lifecycle?.storage?.binaryPersisted === true,
    tempLocalPath: lifecycle?.storage?.tempLocalPath || null,
    tempExists: lifecycle?.storage?.tempExists === true,
    downloaded: lifecycle?.processing?.downloaded === true,
    processed: lifecycle?.processing?.processed === true,
    cleanupAttempted: lifecycle?.processing?.cleanupAttempted === true,
    cleanupRemoved: lifecycle?.processing?.cleanupRemoved === true,
    cleanupReason: lifecycle?.processing?.cleanupReason || null,
    visionAttempted: lifecycle?.processing?.visionAttempted === true,
    visionOk: lifecycle?.processing?.visionOk === true,
    visionReason: lifecycle?.processing?.visionReason || null,
    factsAttempted: lifecycle?.processing?.factsAttempted === true,
    factsOk: lifecycle?.processing?.factsOk === true,
    factsReason: lifecycle?.processing?.factsReason || null,
    retentionEnabled: lifecycle?.retention?.enabled === true,
    archiveEnabled: lifecycle?.retention?.archiveEnabled === true,
    binaryPersistenceAllowed: lifecycle?.retention?.binaryPersistenceAllowed === true,
    policy: lifecycle?.storage?.policy || "n/a",
    routing: compactRoutingRuleForDebug(lifecycle?.routing || null),
  };
}

// ==================================================
// === 11F.2 detect type / summary
// ==================================================
export function summarizeMediaAttachment(msg) {
  if (!msg || typeof msg !== "object") return null;

  const chatId = msg.chat?.id ?? null;
  const messageId = msg.message_id ?? null;

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

export function detectIncomingFileType(msg) {
  return summarizeMediaAttachment(msg);
}

// ==================================================
// === 11F.1 download file
// ==================================================
export async function downloadTelegramFile(botToken, fileId) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  if (!fileId) throw new Error("fileId is missing");

  ensureTmpDir();

  const metaRes = await fetchWithTimeout(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(
      fileId
    )}`,
    { method: "GET" },
    8000
  );
  const metaJson = await metaRes.json();

  if (!metaJson.ok || !metaJson.result?.file_path) {
    throw new Error("Telegram getFile failed");
  }

  const telegramPath = metaJson.result.file_path;

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;
  const fileName = path.basename(telegramPath);
  const localPath = path.join(TMP_DIR, fileName);

  const fileRes = await fetchWithTimeout(fileUrl, { method: "GET" }, 12000);
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
// === cleanup helpers
// ==================================================
export function cleanupDownloadedFile(intake, options = {}) {
  const meta = intake?.meta || makeMeta();
  const localPath = intake?.downloaded?.localPath || null;

  if (intake?.lifecycle?.processing) {
    intake.lifecycle.processing.cleanupAttempted = true;
  }

  if (!localPath) {
    pushLog(meta, "info", "cleanup", "No local file to cleanup.");

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = false;
      intake.lifecycle.processing.cleanupReason = "no_local_path";
    }

    if (intake?.lifecycle?.storage) {
      intake.lifecycle.storage.tempExists = false;
    }

    return {
      ok: true,
      removed: false,
      reason: "no_local_path",
      localPath: null,
      meta,
    };
  }

  try {
    if (!fs.existsSync(localPath)) {
      pushLog(meta, "info", "cleanup", "Local file already missing.", {
        localPath,
      });

      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.cleanupRemoved = false;
        intake.lifecycle.processing.cleanupReason = "already_missing";
      }

      if (intake?.lifecycle?.storage) {
        intake.lifecycle.storage.tempExists = false;
      }

      return {
        ok: true,
        removed: false,
        reason: "already_missing",
        localPath,
        meta,
      };
    }

    fs.unlinkSync(localPath);

    pushLog(meta, "info", "cleanup", "Temporary file removed.", {
      localPath,
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = true;
      intake.lifecycle.processing.cleanupReason = "removed";
    }

    if (intake?.lifecycle?.storage) {
      intake.lifecycle.storage.tempExists = false;
    }

    return {
      ok: true,
      removed: true,
      reason: "removed",
      localPath,
      meta,
    };
  } catch (error) {
    pushLog(meta, "error", "cleanup", "Temporary file cleanup failed.", {
      localPath,
      message: error?.message ? String(error.message) : "unknown_error",
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = false;
      intake.lifecycle.processing.cleanupReason = "cleanup_failed";
    }

    return {
      ok: false,
      removed: false,
      reason: "cleanup_failed",
      localPath,
      error: error?.message ? String(error.message) : "unknown_error",
      meta,
    };
  }
}

export function cleanupIntakeTempFiles(intake, options = {}) {
  return cleanupDownloadedFile(intake, options);
}

// ==================================================
// === 11F.1–11F.3 combined helper
// ==================================================
export async function intakeAndDownloadIfNeeded(msg, botToken) {
  const meta = makeMeta();

  const summary = summarizeMediaAttachment(msg);
  if (!summary) {
    pushLog(meta, "info", "summary", "No attachment in message.");
    return null;
  }

  const lifecycle = buildDataLifecycleSkeleton(summary);
  if (lifecycle?.processing) {
    lifecycle.processing.summaryDone = true;
  }

  pushLog(meta, "info", "summary", "Attachment summarized.", {
    kind: summary.kind,
    fileId: summary.fileId,
    fileName: summary.fileName || null,
    mimeType: summary.mimeType || null,
    fileSize: summary.fileSize || null,
    specializedRoute: lifecycle?.routing?.specializedRoute || null,
  });

  const downloaded = await downloadTelegramFile(botToken, summary.fileId);

  if (lifecycle?.storage) {
    lifecycle.storage.tempLocalPath = downloaded.localPath;
    lifecycle.storage.tempExists = true;
  }
  if (lifecycle?.processing) {
    lifecycle.processing.downloaded = true;
  }

  pushLog(meta, "info", "download", "Attachment downloaded.", {
    fileName: downloaded.fileName,
    size: downloaded.size,
    localPath: downloaded.localPath,
  });

  return {
    ...summary,
    downloaded,
    lifecycle,
    meta,
  };
}

// ==================================================
// === stub/fallback helpers
// ==================================================
function buildStubMessage(summary) {
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

function buildVisionHintForUser(visionResult) {
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

function buildVisibleFactsHintForUser(factsResult) {
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

function buildCombinedDirectHint({ visionResult, factsResult }) {
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

function buildDocumentHintForUser(documentResult, intake = null) {
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

// ==================================================
// === 11F.3 + 12.x process file
// ==================================================
export async function processIncomingFile(intake) {
  const meta = intake?.meta || makeMeta();

  pushLog(meta, "info", "process", "Start processing intake.", {
    kind: intake?.kind,
    fileName: intake?.downloaded?.fileName || intake?.fileName || null,
    specializedRoute: intake?.lifecycle?.routing?.specializedRoute || null,
    genericAiMode: intake?.lifecycle?.routing?.genericAiMode || null,
  });

  let directUserHint = buildStubMessage(intake);
  let processedText = (() => {
    if (!intake) return "";
    const kind = intake.kind || "unknown";
    const fileName = intake?.downloaded?.fileName || intake?.fileName || "";
    const mime = intake?.mimeType || "";
    const route = intake?.lifecycle?.routing?.specializedRoute || "n/a";
    return `File-Intake stub: kind=${kind}; file=${fileName}; mime=${mime || "n/a"}; route=${route}.`;
  })();

  let extractedText = "";
  let extractionAvailable = false;
  let extractionError = null;
  let extractionProviderKey = null;

  let visibleFactsText = "";
  let visibleFactsAvailable = false;
  let visibleFactsError = null;
  let visibleFactsProviderKey = null;

  let documentBlocks = [];
  let documentTitle = null;
  let documentStats = null;
  let documentHeadings = [];
  let documentStructureVersion = null;
  let documentStructureSource = null;

  let shouldCallAI = false;
  let effectiveUserText = "";

  if (canRunVisionForIntake(intake)) {
    const visionStatus = getVisionServiceStatus({
      kind: intake?.kind || "unknown",
      mimeType: intake?.mimeType || null,
    });

    pushLog(meta, "info", "vision", "Vision service status checked.", {
      provider: visionStatus?.provider || "n/a",
      requestedProvider: visionStatus?.requestedProvider || "n/a",
      selectedProviderKey: visionStatus?.selectedProviderKey || "n/a",
      enabled: visionStatus?.enabled === true,
      providerAvailable: visionStatus?.providerAvailable === true,
      ocrEnabled: visionStatus?.ocrEnabled === true,
      extractOnly: visionStatus?.extractOnly === true,
      reason: visionStatus?.reason || "n/a",
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.visionAttempted = true;
    }

    const visionResult = await extractTextWithVisionFromIntake(intake);

    if (visionResult?.ok === true) {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.visionOk = true;
        intake.lifecycle.processing.visionReason = "extract_ok";
      }

      extractedText = safeStr(visionResult.text).trim();
      extractionAvailable = Boolean(extractedText);
      extractionError = null;
      extractionProviderKey = visionResult.providerKey || null;

      processedText += ` vision=ok; provider=${visionResult.providerKey || "n/a"}; textLen=${extractedText.length}.`;

      pushLog(meta, "info", "vision", "Vision OCR result available.", {
        provider: visionResult?.providerKey || "n/a",
        textLen: extractedText.length,
        textPreview: extractedText.slice(0, 200),
      });
    } else {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.visionOk = false;
        intake.lifecycle.processing.visionReason =
          visionResult?.error || "vision_unavailable";
      }

      extractedText = "";
      extractionAvailable = false;
      extractionError = visionResult?.error || "unknown";
      extractionProviderKey = visionResult?.providerKey || null;

      processedText += ` vision=unavailable; reason=${visionResult?.error || "unknown"}.`;

      pushLog(meta, "info", "vision", "Vision OCR unavailable/noop result.", {
        reason: visionResult?.error || "unknown",
        provider: visionResult?.providerKey || "n/a",
      });
    }

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.factsAttempted = true;
    }

    const factsResult = await extractVisibleFactsWithVisionFromIntake(intake);

    if (factsResult?.ok === true) {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.factsOk = true;
        intake.lifecycle.processing.factsReason = "facts_ok";
      }

      visibleFactsText = safeStr(factsResult.text).trim();
      visibleFactsAvailable = Boolean(visibleFactsText);
      visibleFactsError = null;
      visibleFactsProviderKey = factsResult.providerKey || null;

      processedText += ` facts=ok; provider=${factsResult.providerKey || "n/a"}; factsLen=${visibleFactsText.length}.`;

      pushLog(meta, "info", "vision", "Visible facts result available.", {
        provider: factsResult?.providerKey || "n/a",
        factsLen: visibleFactsText.length,
        factsPreview: visibleFactsText.slice(0, 200),
      });
    } else {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.factsOk = false;
        intake.lifecycle.processing.factsReason =
          factsResult?.error || "facts_unavailable";
      }

      visibleFactsText = "";
      visibleFactsAvailable = false;
      visibleFactsError = factsResult?.error || "unknown";
      visibleFactsProviderKey = factsResult?.providerKey || null;

      processedText += ` facts=unavailable; reason=${factsResult?.error || "unknown"}.`;

      pushLog(meta, "info", "vision", "Visible facts unavailable/noop result.", {
        reason: factsResult?.error || "unknown",
        provider: factsResult?.providerKey || "n/a",
      });
    }

    directUserHint =
      buildCombinedDirectHint({
        visionResult,
        factsResult,
      }) || directUserHint;
  }

  if (canRunDocumentTextForIntake(intake)) {
    const documentStatus = getDocumentTextServiceStatus({
      fileName: intake?.downloaded?.fileName || intake?.fileName || "",
      mimeType: intake?.mimeType || null,
    });

    pushLog(meta, "info", "document", "Document text service status checked.", {
      enabled: documentStatus?.enabled === true,
      extractOnly: documentStatus?.extractOnly === true,
      extension: documentStatus?.extension || "",
      mimeType: documentStatus?.mimeType || null,
      pdfReady: documentStatus?.pdfReady === true,
      docxReady: documentStatus?.docxReady === true,
      structuringReady: documentStatus?.structuringReady === true,
    });

    const documentResult = await extractTextFromDocumentIntake(intake);

    if (documentResult?.ok === true) {
      extractedText = safeStr(documentResult.text).trim();
      extractionAvailable = Boolean(extractedText);
      extractionError = null;
      extractionProviderKey = documentResult.providerKey || null;

      const docMeta = safeDocumentMeta(documentResult?.meta || {});
      documentBlocks = Array.isArray(documentResult?.blocks)
        ? documentResult.blocks
        : [];
      documentTitle = docMeta.title;
      documentStats = docMeta.stats;
      documentHeadings = docMeta.headings;
      documentStructureVersion = docMeta.structureVersion;
      documentStructureSource = docMeta.structureSource;

      processedText += ` document=ok; provider=${documentResult.providerKey || "n/a"}; textLen=${extractedText.length}.`;

      if (documentStats) {
        processedText += ` documentBlocks=${documentStats.blockCount}; documentHeadings=${documentStats.headingCount}; documentWords=${documentStats.wordCount}.`;
      }

      pushLog(meta, "info", "document", "Document extraction result available.", {
        provider: documentResult?.providerKey || "n/a",
        textLen: extractedText.length,
        textPreview: extractedText.slice(0, 200),
        title: documentTitle,
        structureVersion: documentStructureVersion,
        structureSource: documentStructureSource,
        blockCount: documentStats?.blockCount ?? 0,
        headingCount: documentStats?.headingCount ?? 0,
        wordCount: documentStats?.wordCount ?? 0,
      });

      saveDocumentSessionCache({
        chatId: intake?.chatId ?? intake?.lifecycle?.identity?.chatId ?? null,
        fileName: intake?.downloaded?.fileName || intake?.fileName || "document",
        text: extractedText,
        title: documentTitle,
        stats: documentStats,
        headings: documentHeadings,
        blocks: documentBlocks,
        structureVersion: documentStructureVersion,
        structureSource: documentStructureSource,
      });

      shouldCallAI = true;
      effectiveUserText = buildAutoSummaryRequestText(
        intake?.downloaded?.fileName || intake?.fileName || "document"
      );
      directUserHint = null;
    } else {
      extractedText = "";
      extractionAvailable = false;
      extractionError = documentResult?.error || "unknown";
      extractionProviderKey = documentResult?.providerKey || null;

      processedText += ` document=unavailable; reason=${documentResult?.error || "unknown"}.`;

      pushLog(meta, "info", "document", "Document extraction unavailable/noop result.", {
        reason: documentResult?.error || "unknown",
        provider: documentResult?.providerKey || "n/a",
      });

      directUserHint = buildDocumentHintForUser(documentResult, intake) || directUserHint;
    }
  }

  pushLog(meta, "info", "process", "Processing complete.", {
    processedText,
    documentTitle,
    documentStats,
    documentStructureVersion,
    documentStructureSource,
    shouldCallAI,
  });

  if (intake?.lifecycle?.processing) {
    intake.lifecycle.processing.processed = true;
  }

  return {
    ok: true,
    processedText,
    directUserHint,

    shouldCallAI,
    effectiveUserText,

    extractedText,
    extractionAvailable,
    extractionError,
    extractionProviderKey,

    visibleFactsText,
    visibleFactsAvailable,
    visibleFactsError,
    visibleFactsProviderKey,

    documentBlocks,
    documentTitle,
    documentStats,
    documentHeadings,
    documentStructureVersion,
    documentStructureSource,

    lifecycle: intake?.lifecycle || null,
    meta,
  };
}

export async function processFile(intake) {
  return processIncomingFile(intake);
}

// ==================================================
// === 11F.9 effectiveUserText + decision
// ==================================================
export function buildEffectiveUserTextAndDecision(userText, mediaSummary) {
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
        aiRouting: null,
      },
    };
  }

  const stub = buildStubMessage(mediaSummary);
  const aiRouting = buildSpecializedAIRoutingRule(mediaSummary);

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
        aiRouting,
      },
    };
  }

  const mediaNote = (() => {
    if (mediaSummary.kind === "photo") {
      return "Вложение: фото. Специализированный маршрут: Vision-class. Generic AI видит только твой текст, не изображение напрямую.";
    }
    if (mediaSummary.kind === "document") {
      return `Вложение: документ (${mediaSummary.fileName || "file"}). Специализированный маршрут: Document-parse/OCR-class. Generic AI видит только твой текст, не файл.`;
    }
    if (mediaSummary.kind === "voice") {
      return "Вложение: голосовое. Специализированный маршрут: STT-class. Generic AI видит только твой текст, не аудио.";
    }
    if (mediaSummary.kind === "audio") {
      return "Вложение: аудио. Специализированный маршрут: STT-class. Generic AI видит только твой текст, не аудио.";
    }
    if (mediaSummary.kind === "video") {
      return "Вложение: видео. Специализированный маршрут: Video-extract-class. Generic AI видит только твой текст, не видео.";
    }
    return "Вложение: файл. Generic AI видит только твой текст, не binary payload.";
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
      aiRouting,
    },
  };
}

// ==================================================
// === 11F.10 logs
// ==================================================
export function formatFileIntakeLogs(meta, limit = 20) {
  const logs = meta?.logs || [];
  if (!logs.length) return "File-Intake logs: empty.";

  const slice = logs.slice(-toIntOr(limit, 20));
  let out = "🧾 File-Intake logs\n\n";

  for (const l of slice) {
    out += `• ${l.t} [${l.level}] ${l.step}: ${l.msg}\n`;
    if (l.data) {
      out += `  data: ${safeStr(JSON.stringify(l.data)).slice(0, 600)}\n`;
    }
  }

  return out.trim();
}