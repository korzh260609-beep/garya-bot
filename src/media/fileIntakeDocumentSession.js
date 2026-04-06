// src/media/fileIntakeDocumentSession.js
// ==================================================
// FILE-INTAKE DOCUMENT SESSION
// Purpose:
// - document text split
// - session cache
// - recent session binding
// - document commands (full text / continue)
// - estimate helpers
// ==================================================

import {
  DOCUMENT_REPLY_CHUNK_SIZE,
  DOCUMENT_SESSION_BIND_WINDOW_MS,
  safeStr,
  nowIso,
  nowMs,
  normalizeCommandText,
} from "./fileIntakeCore.js";

const DOCUMENT_SESSION_CACHE = new Map();

export function splitTextIntoChunks(text, chunkSize = DOCUMENT_REPLY_CHUNK_SIZE) {
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

export function buildDocumentPartReply(cache, partIndex) {
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

export function buildChunkStartPreview(text) {
  const src = safeStr(text)
    .replace(/\s+/g, " ")
    .trim();

  if (!src) return "";

  if (src.length <= 90) return src;
  return `${src.slice(0, 90).trim()}…`;
}

export function isDocumentFullTextCommand(value) {
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

export function isDocumentContinueCommand(value) {
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

export function safeDocumentMeta(meta = {}) {
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

export function buildAutoSummaryRequestText(fileName) {
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

export function saveDocumentSessionCache({
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

export function touchDocumentSessionCache(cache) {
  if (!cache || typeof cache !== "object") return;
  cache.lastUsedAt = nowIso();
  cache.lastUsedAtMs = nowMs();
}

export function getDocumentReplyChunkSize() {
  return DOCUMENT_REPLY_CHUNK_SIZE;
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

export function estimateRecentDocumentChatSplit(chatId) {
  const cache = getRecentDocumentSessionCache(chatId);
  if (!cache) return null;

  const chunks = Array.isArray(cache?.chunks) ? cache.chunks : [];
  const text = safeStr(cache?.text || "");
  const fileName = safeStr(cache?.fileName || "document");

  return {
    ok: true,
    fileName,
    chunkSize: DOCUMENT_REPLY_CHUNK_SIZE,
    chunkCount: chunks.length,
    charCount: text.length,
    currentPartIndex: Number(cache?.nextChunkIndex || 0),
  };
}

export function estimateRecentDocumentChatSplitDetailed(chatId) {
  const cache = getRecentDocumentSessionCache(chatId);
  if (!cache) return null;

  const chunks = Array.isArray(cache?.chunks) ? cache.chunks : [];
  const text = safeStr(cache?.text || "");
  const fileName = safeStr(cache?.fileName || "document");

  const parts = chunks.map((chunk, index) => ({
    partNumber: index + 1,
    charCount: safeStr(chunk).length,
    startsWith: buildChunkStartPreview(chunk),
  }));

  return {
    ok: true,
    fileName,
    chunkSize: DOCUMENT_REPLY_CHUNK_SIZE,
    chunkCount: chunks.length,
    charCount: text.length,
    currentPartIndex: Number(cache?.nextChunkIndex || 0),
    parts,
  };
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

export default {
  splitTextIntoChunks,
  buildDocumentPartReply,
  buildChunkStartPreview,
  isDocumentFullTextCommand,
  isDocumentContinueCommand,
  safeDocumentMeta,
  buildAutoSummaryRequestText,
  saveDocumentSessionCache,
  touchDocumentSessionCache,
  getDocumentReplyChunkSize,
  getDocumentSessionCache,
  getRecentDocumentSessionCache,
  estimateRecentDocumentChatSplit,
  estimateRecentDocumentChatSplitDetailed,
  shouldBindMessageToRecentDocumentSession,
  tryHandleDocumentSessionCommand,
};