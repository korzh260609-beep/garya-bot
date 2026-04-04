// src/bot/handlers/chat/outputSessionCache.js
// ============================================================================
// STAGE 12A.2 — OUTPUT SESSION CACHE
// Purpose:
// - keep recent exportable text per chat
// - support export of:
//   1) latest document text
//   2) latest assistant reply text
// - allow explicit source selection: document / assistant reply
// - add document export targets:
//   - summary
//   - full_text
//   - current_part
//   - assistant_answer_about_document
// - no DB persistence here
// - no AI here
// ============================================================================

import { getActiveDocumentExportTarget } from "./activeDocumentExportTargetCache.js";
import { getActiveExportSource } from "./activeExportSourceCache.js";

const OUTPUT_SESSION_CACHE = new Map();
const OUTPUT_SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 min

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeExportText(value) {
  return safeText(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function safeBaseName(value, fallback = "export") {
  const src = safeText(value).trim() || fallback;

  const cleaned = src
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "");

  return cleaned || fallback;
}

function buildCacheRecord({
  kind = "assistant_reply",
  chatId,
  text,
  baseName,
  meta = {},
}) {
  return {
    kind: safeText(kind).trim() || "assistant_reply",
    chatId: String(chatId || "").trim(),
    text: normalizeExportText(text),
    baseName: safeBaseName(
      baseName,
      kind === "document" ? "document" : "assistant_reply"
    ),
    createdAt: nowIso(),
    createdAtMs: nowMs(),
    lastUsedAt: nowIso(),
    lastUsedAtMs: nowMs(),
    meta: meta && typeof meta === "object" ? meta : {},
  };
}

function touchCacheRecord(record) {
  if (!record || typeof record !== "object") return;
  record.lastUsedAt = nowIso();
  record.lastUsedAtMs = nowMs();
}

function getChatBucket(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;
  return OUTPUT_SESSION_CACHE.get(key) || null;
}

function setChatBucket(chatId, bucket) {
  const key = String(chatId || "").trim();
  if (!key) return null;
  OUTPUT_SESSION_CACHE.set(key, bucket);
  return bucket;
}

function isFresh(record) {
  const ts = Number(record?.lastUsedAtMs || record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= OUTPUT_SESSION_WINDOW_MS;
}

export function saveRecentAssistantReplyForExport({
  chatId,
  text,
  baseName = "assistant_reply",
  meta = {},
}) {
  const normalizedText = normalizeExportText(text);
  const key = String(chatId || "").trim();

  if (!key || !normalizedText) return null;

  const bucket = getChatBucket(key) || {};
  bucket.assistantReply = buildCacheRecord({
    kind: "assistant_reply",
    chatId: key,
    text: normalizedText,
    baseName,
    meta,
  });

  setChatBucket(key, bucket);
  return bucket.assistantReply;
}

export function saveRecentDocumentForExport({
  chatId,
  text,
  baseName = "document",
  meta = {},
}) {
  const normalizedText = normalizeExportText(text);
  const key = String(chatId || "").trim();

  if (!key || !normalizedText) return null;

  const bucket = getChatBucket(key) || {};
  bucket.document = buildCacheRecord({
    kind: "document",
    chatId: key,
    text: normalizedText,
    baseName,
    meta,
  });

  setChatBucket(key, bucket);
  return bucket.document;
}

export function saveRecentDocumentSummaryForExport({
  chatId,
  text,
  baseName = "document_summary",
  meta = {},
}) {
  const normalizedText = normalizeExportText(text);
  const key = String(chatId || "").trim();

  if (!key || !normalizedText) return null;

  const bucket = getChatBucket(key) || {};
  bucket.documentSummary = buildCacheRecord({
    kind: "document_summary",
    chatId: key,
    text: normalizedText,
    baseName,
    meta,
  });

  setChatBucket(key, bucket);
  return bucket.documentSummary;
}

export function saveRecentDocumentCurrentPartForExport({
  chatId,
  text,
  baseName = "document_part",
  meta = {},
}) {
  const normalizedText = normalizeExportText(text);
  const key = String(chatId || "").trim();

  if (!key || !normalizedText) return null;

  const bucket = getChatBucket(key) || {};
  bucket.documentCurrentPart = buildCacheRecord({
    kind: "document_current_part",
    chatId: key,
    text: normalizedText,
    baseName,
    meta,
  });

  setChatBucket(key, bucket);
  return bucket.documentCurrentPart;
}

export function saveRecentAssistantAnswerAboutDocumentForExport({
  chatId,
  text,
  baseName = "document_answer",
  meta = {},
}) {
  const normalizedText = normalizeExportText(text);
  const key = String(chatId || "").trim();

  if (!key || !normalizedText) return null;

  const bucket = getChatBucket(key) || {};
  bucket.documentAssistantAnswer = buildCacheRecord({
    kind: "document_assistant_answer",
    chatId: key,
    text: normalizedText,
    baseName,
    meta,
  });

  setChatBucket(key, bucket);
  return bucket.documentAssistantAnswer;
}

export function getRecentExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  if (!bucket) return null;

  const doc = bucket.document;
  const reply = bucket.assistantReply;

  const freshDoc = isFresh(doc) ? doc : null;
  const freshReply = isFresh(reply) ? reply : null;

  if (!freshDoc && !freshReply) {
    return null;
  }

  if (freshDoc && !freshReply) {
    touchCacheRecord(freshDoc);
    return freshDoc;
  }

  if (!freshDoc && freshReply) {
    touchCacheRecord(freshReply);
    return freshReply;
  }

  const docTs = Number(freshDoc?.lastUsedAtMs || freshDoc?.createdAtMs || 0);
  const replyTs = Number(
    freshReply?.lastUsedAtMs || freshReply?.createdAtMs || 0
  );

  const winner = docTs >= replyTs ? freshDoc : freshReply;
  touchCacheRecord(winner);
  return winner;
}

export function getRecentDocumentExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  const doc = bucket?.document || null;
  if (!doc || !isFresh(doc)) return null;
  touchCacheRecord(doc);
  return doc;
}

export function getRecentAssistantReplyExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  const reply = bucket?.assistantReply || null;
  if (!reply || !isFresh(reply)) return null;
  touchCacheRecord(reply);
  return reply;
}

export function getRecentDocumentSummaryExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  const item = bucket?.documentSummary || null;
  if (!item || !isFresh(item)) return null;
  touchCacheRecord(item);
  return item;
}

export function getRecentDocumentCurrentPartExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  const item = bucket?.documentCurrentPart || null;
  if (!item || !isFresh(item)) return null;
  touchCacheRecord(item);
  return item;
}

export function getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) {
  const bucket = getChatBucket(chatId);
  const item = bucket?.documentAssistantAnswer || null;
  if (!item || !isFresh(item)) return null;
  touchCacheRecord(item);
  return item;
}

export function getExplicitExportCandidate(chatId, preferredKind = "") {
  const normalized = safeText(preferredKind).trim().toLowerCase();

  if (normalized === "document") {
    return getRecentDocumentExportCandidate(chatId);
  }

  if (normalized === "assistant_reply") {
    return getRecentAssistantReplyExportCandidate(chatId);
  }

  const activeSourceRecord = getActiveExportSource(chatId);
  const activeSourceKind = safeText(activeSourceRecord?.sourceKind).toLowerCase();

  if (activeSourceKind === "assistant_reply") {
    return (
      getRecentAssistantReplyExportCandidate(chatId) ||
      getRecentDocumentExportCandidate(chatId)
    );
  }

  if (activeSourceKind === "document") {
    return (
      getRecentDocumentExportCandidate(chatId) ||
      getRecentAssistantReplyExportCandidate(chatId)
    );
  }

  return getRecentExportCandidate(chatId);
}

export function getDocumentExportTargetCandidate(chatId, target = "") {
  const normalized = safeText(target).trim().toLowerCase();

  if (normalized === "summary") {
    return getRecentDocumentSummaryExportCandidate(chatId);
  }

  if (normalized === "full_text") {
    return getRecentDocumentExportCandidate(chatId);
  }

  if (normalized === "current_part") {
    return getRecentDocumentCurrentPartExportCandidate(chatId);
  }

  if (normalized === "assistant_answer_about_document") {
    return getRecentAssistantAnswerAboutDocumentExportCandidate(chatId);
  }

  const activeTargetRecord = getActiveDocumentExportTarget(chatId);
  const activeTarget = safeText(activeTargetRecord?.target).toLowerCase();

  if (activeTarget === "summary") {
    return (
      getRecentDocumentSummaryExportCandidate(chatId) ||
      getRecentDocumentCurrentPartExportCandidate(chatId) ||
      getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) ||
      getRecentDocumentExportCandidate(chatId)
    );
  }

  if (activeTarget === "full_text") {
    return (
      getRecentDocumentExportCandidate(chatId) ||
      getRecentDocumentCurrentPartExportCandidate(chatId) ||
      getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) ||
      getRecentDocumentSummaryExportCandidate(chatId)
    );
  }

  if (activeTarget === "current_part") {
    return (
      getRecentDocumentCurrentPartExportCandidate(chatId) ||
      getRecentDocumentSummaryExportCandidate(chatId) ||
      getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) ||
      getRecentDocumentExportCandidate(chatId)
    );
  }

  if (activeTarget === "assistant_answer_about_document") {
    return (
      getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) ||
      getRecentDocumentSummaryExportCandidate(chatId) ||
      getRecentDocumentCurrentPartExportCandidate(chatId) ||
      getRecentDocumentExportCandidate(chatId)
    );
  }

  return (
    getRecentDocumentSummaryExportCandidate(chatId) ||
    getRecentDocumentCurrentPartExportCandidate(chatId) ||
    getRecentAssistantAnswerAboutDocumentExportCandidate(chatId) ||
    getRecentDocumentExportCandidate(chatId)
  );
}

export function clearExportSessionCache(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return OUTPUT_SESSION_CACHE.delete(key);
}

export default {
  saveRecentAssistantReplyForExport,
  saveRecentDocumentForExport,
  saveRecentDocumentSummaryForExport,
  saveRecentDocumentCurrentPartForExport,
  saveRecentAssistantAnswerAboutDocumentForExport,
  getRecentExportCandidate,
  getRecentDocumentExportCandidate,
  getRecentAssistantReplyExportCandidate,
  getRecentDocumentSummaryExportCandidate,
  getRecentDocumentCurrentPartExportCandidate,
  getRecentAssistantAnswerAboutDocumentExportCandidate,
  getExplicitExportCandidate,
  getDocumentExportTargetCandidate,
  clearExportSessionCache,
};