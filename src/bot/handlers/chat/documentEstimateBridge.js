// src/bot/handlers/chat/documentEstimateBridge.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT ESTIMATE BRIDGE
// Purpose:
// - resolve active document for estimate-mode through multiple sources
// - priority:
//   1) recent runtime document session
//   2) active document context cache
//   3) recent raw document export candidate
// - expose deterministic split reuse for estimate + requested part content
// - no AI
// ============================================================================

import { getRecentDocumentExportCandidate } from "./outputSessionCache.js";
import { getActiveDocumentContext } from "./activeDocumentContextCache.js";

export const DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE = 3200;

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeChunkSize(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTextForSplit(value) {
  return safeText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function skipLeadingWhitespace(src, index) {
  let i = Number(index || 0);
  while (i < src.length && /\s/.test(src[i])) {
    i += 1;
  }
  return i;
}

function findLastRegexBoundary(src, fromIndex, minIndex, regex) {
  const safeFrom = clamp(Number(fromIndex || 0), 0, src.length);
  const safeMin = clamp(Number(minIndex || 0), 0, safeFrom);
  const slice = src.slice(safeMin, safeFrom);
  if (!slice) return -1;

  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);

  let lastMatch = null;
  let match = re.exec(slice);

  while (match) {
    lastMatch = match;
    match = re.exec(slice);
  }

  if (!lastMatch) return -1;
  return safeMin + lastMatch.index + lastMatch[0].length;
}

function findFirstRegexBoundary(src, fromIndex, maxIndex, regex) {
  const safeFrom = clamp(Number(fromIndex || 0), 0, src.length);
  const safeMax = clamp(Number(maxIndex || 0), safeFrom, src.length);
  const slice = src.slice(safeFrom, safeMax);
  if (!slice) return -1;

  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const match = re.exec(slice);

  if (!match) return -1;
  return safeFrom + match.index + match[0].length;
}

function findLastStringBoundary(src, fromIndex, minIndex, token) {
  const safeFrom = clamp(Number(fromIndex || 0), 0, src.length);
  const safeMin = clamp(Number(minIndex || 0), 0, safeFrom);
  const idx = src.lastIndexOf(token, safeFrom);
  if (idx < safeMin) return -1;
  return idx + token.length;
}

function findBestSplitIndex(src, start, chunkSize) {
  const hardEnd = Math.min(start + chunkSize, src.length);
  if (hardEnd >= src.length) {
    return src.length;
  }

  const minChunkLength = Math.max(900, Math.floor(chunkSize * 0.55));
  const minSplitIndex = Math.min(start + minChunkLength, hardEnd);

  const backwardParagraphWindow = Math.max(start, hardEnd - 1200);
  const backwardSentenceWindow = Math.max(start, hardEnd - 500);
  const backwardLineWindow = Math.max(start, hardEnd - 700);
  const backwardSpaceWindow = Math.max(start, hardEnd - 220);

  const forwardSoftLimit = Math.min(src.length, hardEnd + 140);

  const paragraphBoundaryRegex = /\n\s*\n+/g;
  const numberedLineBoundaryRegex =
    /\n(?=\s*(?:\d+(?:\.\d+)*[.)]?|[A-ZА-ЯІЇЄҐ]))/g;
  const sentenceBoundaryRegex = /[.!?…;:](?:["»”')\]]*)\s+/g;
  const newlineBoundaryRegex = /\n+/g;
  const spaceBoundaryRegex = /\s+/g;

  let splitAt = -1;

  splitAt = findLastRegexBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardParagraphWindow),
    paragraphBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findFirstRegexBoundary(
    src,
    hardEnd,
    forwardSoftLimit,
    paragraphBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findLastRegexBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardLineWindow),
    numberedLineBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findLastRegexBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardSentenceWindow),
    sentenceBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findFirstRegexBoundary(
    src,
    hardEnd,
    forwardSoftLimit,
    sentenceBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findLastRegexBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardLineWindow),
    newlineBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  splitAt = findFirstRegexBoundary(src, hardEnd, forwardSoftLimit, newlineBoundaryRegex);
  if (splitAt > start) return splitAt;

  splitAt = findLastStringBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardSpaceWindow),
    " "
  );
  if (splitAt > start) return splitAt;

  splitAt = findLastRegexBoundary(
    src,
    hardEnd,
    Math.max(minSplitIndex, backwardSpaceWindow),
    spaceBoundaryRegex
  );
  if (splitAt > start) return splitAt;

  return hardEnd;
}

export function splitTextIntoChunks(
  text,
  chunkSize = DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE
) {
  const src = normalizeTextForSplit(text);
  if (!src) return [];

  const normalizedChunkSize = normalizeChunkSize(chunkSize);
  const chunks = [];
  let start = 0;

  while (start < src.length) {
    start = skipLeadingWhitespace(src, start);
    if (start >= src.length) break;

    const splitAt = findBestSplitIndex(src, start, normalizedChunkSize);
    const safeSplitAt =
      Number.isFinite(splitAt) && splitAt > start
        ? Math.min(splitAt, src.length)
        : Math.min(start + normalizedChunkSize, src.length);

    const chunk = src.slice(start, safeSplitAt).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (safeSplitAt >= src.length) {
      break;
    }

    const nextStart = skipLeadingWhitespace(src, safeSplitAt);
    if (nextStart <= start) {
      start = safeSplitAt + 1;
    } else {
      start = nextStart;
    }
  }

  return chunks.filter(Boolean);
}

function buildChunkStartPreview(text) {
  const src = safeText(text).replace(/\s+/g, " ").trim();
  if (!src) return "";
  if (src.length <= 90) return src;
  return `${src.slice(0, 90).trim()}…`;
}

export function buildDetailedEstimate({
  fileName = "document",
  text = "",
  chunkSize = DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE,
  currentPartIndex = 0,
  source = "unknown",
}) {
  const normalizedText = normalizeTextForSplit(text);
  const normalizedChunkSize = normalizeChunkSize(chunkSize);
  const chunks = splitTextIntoChunks(normalizedText, normalizedChunkSize);

  return {
    ok: true,
    fileName: safeText(fileName).trim() || "document",
    chunkSize: normalizedChunkSize,
    chunkCount: chunks.length,
    charCount: normalizedText.length,
    currentPartIndex: Number(currentPartIndex || 0) || 0,
    source,
    parts: chunks.map((chunk, index) => ({
      partNumber: index + 1,
      charCount: safeText(chunk).length,
      startsWith: buildChunkStartPreview(chunk),
    })),
  };
}

function resolveRecentDocumentRawCandidate({ chatId, FileIntake }) {
  const normalizedChatId = chatId ?? null;

  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  if (getRecentDocumentSessionCache) {
    const cache = getRecentDocumentSessionCache(normalizedChatId);

    if (cache?.text) {
      return {
        ok: true,
        fileName: cache?.fileName || cache?.title || "document",
        text: normalizeTextForSplit(cache.text),
        currentPartIndex: Number(cache?.nextChunkIndex || 0) || 0,
        source: "runtime_document_session",
      };
    }
  }

  const activeDocument = getActiveDocumentContext(normalizedChatId);
  if (activeDocument?.text) {
    return {
      ok: true,
      fileName: activeDocument?.fileName || activeDocument?.title || "document",
      text: normalizeTextForSplit(activeDocument.text),
      currentPartIndex: 0,
      source: "active_document_context",
    };
  }

  const exportCandidate = getRecentDocumentExportCandidate(normalizedChatId);
  if (exportCandidate?.text) {
    return {
      ok: true,
      fileName:
        exportCandidate?.meta?.fileName ||
        exportCandidate?.meta?.title ||
        exportCandidate?.baseName ||
        "document",
      text: normalizeTextForSplit(exportCandidate.text),
      currentPartIndex: 0,
      source: "recent_document_export_candidate",
    };
  }

  return null;
}

export function resolveRecentDocumentEstimateCandidate({ chatId, FileIntake }) {
  const normalizedChatId = chatId ?? null;

  const getDocumentReplyChunkSize =
    typeof FileIntake?.getDocumentReplyChunkSize === "function"
      ? FileIntake.getDocumentReplyChunkSize
      : null;

  const chunkSize = getDocumentReplyChunkSize
    ? getDocumentReplyChunkSize()
    : DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE;

  const raw = resolveRecentDocumentRawCandidate({
    chatId: normalizedChatId,
    FileIntake,
  });

  if (!raw?.ok || !raw?.text) {
    return null;
  }

  return buildDetailedEstimate({
    fileName: raw.fileName,
    text: raw.text,
    chunkSize,
    currentPartIndex: raw.currentPartIndex,
    source: raw.source,
  });
}

export function resolveRecentDocumentPartsCandidate({ chatId, FileIntake }) {
  const normalizedChatId = chatId ?? null;

  const getDocumentReplyChunkSize =
    typeof FileIntake?.getDocumentReplyChunkSize === "function"
      ? FileIntake.getDocumentReplyChunkSize
      : null;

  const chunkSize = getDocumentReplyChunkSize
    ? getDocumentReplyChunkSize()
    : DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE;

  const raw = resolveRecentDocumentRawCandidate({
    chatId: normalizedChatId,
    FileIntake,
  });

  if (!raw?.ok || !raw?.text) {
    return null;
  }

  const normalizedText = normalizeTextForSplit(raw.text);
  const normalizedChunkSize = normalizeChunkSize(chunkSize);
  const chunks = splitTextIntoChunks(normalizedText, normalizedChunkSize);

  return {
    ok: true,
    fileName: raw.fileName,
    source: raw.source,
    chunkSize: normalizedChunkSize,
    charCount: normalizedText.length,
    chunkCount: chunks.length,
    currentPartIndex: raw.currentPartIndex,
    chunks,
    estimate: buildDetailedEstimate({
      fileName: raw.fileName,
      text: normalizedText,
      chunkSize: normalizedChunkSize,
      currentPartIndex: raw.currentPartIndex,
      source: raw.source,
    }),
  };
}

export default {
  DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE,
  splitTextIntoChunks,
  buildDetailedEstimate,
  resolveRecentDocumentEstimateCandidate,
  resolveRecentDocumentPartsCandidate,
};