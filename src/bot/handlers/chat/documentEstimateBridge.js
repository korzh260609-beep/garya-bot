// src/bot/handlers/chat/documentEstimateBridge.js
// ============================================================================
// STAGE 12A.2 — DOCUMENT ESTIMATE BRIDGE
// Purpose:
// - resolve active document for estimate-mode through multiple sources
// - priority:
//   1) recent runtime document session
//   2) active document context cache
//   3) recent raw document export candidate
// - no AI
// ============================================================================

import { getRecentDocumentExportCandidate } from "./outputSessionCache.js";
import { getActiveDocumentContext } from "./activeDocumentContextCache.js";

const DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE = 3200;

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

function splitTextIntoChunks(text, chunkSize = DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE) {
  const src = safeText(text);
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

function buildChunkStartPreview(text) {
  const src = safeText(text).replace(/\s+/g, " ").trim();
  if (!src) return "";
  if (src.length <= 90) return src;
  return `${src.slice(0, 90).trim()}…`;
}

function buildDetailedEstimate({
  fileName = "document",
  text = "",
  chunkSize = DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE,
  currentPartIndex = 0,
  source = "unknown",
}) {
  const normalizedText = safeText(text).trim();
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

export function resolveRecentDocumentEstimateCandidate({ chatId, FileIntake }) {
  const normalizedChatId = chatId ?? null;

  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  const getDocumentReplyChunkSize =
    typeof FileIntake?.getDocumentReplyChunkSize === "function"
      ? FileIntake.getDocumentReplyChunkSize
      : null;

  const chunkSize = getDocumentReplyChunkSize
    ? getDocumentReplyChunkSize()
    : DEFAULT_DOCUMENT_REPLY_CHUNK_SIZE;

  if (getRecentDocumentSessionCache) {
    const cache = getRecentDocumentSessionCache(normalizedChatId);

    if (cache?.text) {
      return buildDetailedEstimate({
        fileName: cache?.fileName || cache?.title || "document",
        text: cache.text,
        chunkSize,
        currentPartIndex: cache?.nextChunkIndex || 0,
        source: "runtime_document_session",
      });
    }
  }

  const activeDocument = getActiveDocumentContext(normalizedChatId);
  if (activeDocument?.text) {
    return buildDetailedEstimate({
      fileName: activeDocument?.fileName || activeDocument?.title || "document",
      text: activeDocument.text,
      chunkSize,
      currentPartIndex: 0,
      source: "active_document_context",
    });
  }

  const exportCandidate = getRecentDocumentExportCandidate(normalizedChatId);
  if (exportCandidate?.text) {
    return buildDetailedEstimate({
      fileName:
        exportCandidate?.meta?.fileName ||
        exportCandidate?.meta?.title ||
        exportCandidate?.baseName ||
        "document",
      text: exportCandidate.text,
      chunkSize,
      currentPartIndex: 0,
      source: "recent_document_export_candidate",
    });
  }

  return null;
}

export default {
  resolveRecentDocumentEstimateCandidate,
};