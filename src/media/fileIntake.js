// src/media/fileIntake.js
// ==================================================
// STAGE 11F + STAGE 12.3 — FILE-INTAKE + REAL OCR OUTPUT BRIDGE
// 11F.1 download file
// 11F.2 detect type
// 11F.3 process file (routing + stub)
// 11F.9 effectiveUserText
// 11F.10 logs
// 11F.11 DATA LIFECYCLE skeleton
// 11F.12 AI routing rule skeleton
//
// 12.x OCR vision routing/service/provider bridge
// - provider router exists
// - OpenAI may already be real/ready
// - other providers may still be skeleton-only
//
// CURRENT STATUS:
// - определяет вложение из Telegram msg (summary)
// - умеет скачать файл по file_id
// - умеет сделать базовый routing/stub
// - даёт расширенные intake logs
// - умеет чистить временные файлы после обработки
// - lifecycle хранит только meta/links, не binary
// - routing rule задаёт specialized-first policy
// - vision service contract integrated
//
// IMPORTANT:
// - media-only path must return real OCR text when provider succeeded
// - if OCR fails, return honest fallback with exact reason
// - generic AI is still text fallback only for media+text flows
// ==================================================

import fs from "fs";
import path from "path";
import { fetchWithTimeout } from "../core/fetchWithTimeout.js";
import {
  getVisionServiceStatus,
  extractTextWithVisionFromIntake,
  canRunVisionForIntake,
} from "../vision/visionService.js";

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
          "Photo should route to Vision-class handler; current runtime may return real OCR if provider is active.",
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
          "Document must go to parser/OCR-class handler in future; current runtime allows only text fallback.",
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

// Явный alias под wording WORKFLOW
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

// Явный alias под wording future/runtime
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
// === stub helpers
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

      directUserHint = buildVisionHintForUser(visionResult);

      pushLog(meta, "info", "vision", "Vision extract-only result available.", {
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

      directUserHint = buildVisionHintForUser(visionResult);

      pushLog(meta, "info", "vision", "Vision unavailable/noop result.", {
        reason: visionResult?.error || "unknown",
        provider: visionResult?.providerKey || "n/a",
      });
    }
  }

  pushLog(meta, "info", "process", "Processing complete.", {
    processedText,
  });

  if (intake?.lifecycle?.processing) {
    intake.lifecycle.processing.processed = true;
  }

  return {
    ok: true,
    processedText,
    directUserHint,
    extractedText,
    extractionAvailable,
    extractionError,
    extractionProviderKey,
    lifecycle: intake?.lifecycle || null,
    meta,
  };
}

// Явный alias под wording WORKFLOW
export async function processFile(intake) {
  return processIncomingFile(intake);
}

// ==================================================
// === 11F.9 effectiveUserText + decision
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
 * - semantic divergence between storage and AI-facing text is intentional
 *
 * VERIFIED RUNTIME BOUNDARY:
 * - this function decides how chat.js should talk to AI right now
 * - this function does NOT decide how inbound messages are stored in chat_messages
 * - this function does NOT own dedupe semantics
 *
 * Главный хелпер:
 * - если у пользователя НЕТ текста и НЕТ caption, но есть медиа → возвращаем stub/ocr и НЕ зовём AI
 * - если текст есть (включая caption у фото/доков) → зовём AI, но только как text fallback,
 *   без доступа generic AI к binary/media payload
 */
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
      return "Вложение: фото. Специализированный маршрут: Vision-class. Generic AI видит только твой текст, не изображение.";
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