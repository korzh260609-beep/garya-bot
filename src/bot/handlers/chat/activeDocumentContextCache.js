// src/bot/handlers/chat/activeDocumentContextCache.js
// ============================================================================
// STAGE 12A.2 — ACTIVE DOCUMENT CONTEXT CACHE
// Purpose:
// - keep currently active discussed document per chat
// - stronger than runtime-only document session
// - no AI
// - no DB
// ============================================================================

const ACTIVE_DOCUMENT_CONTEXT_CACHE = new Map();
const ACTIVE_DOCUMENT_CONTEXT_WINDOW_MS = 60 * 60 * 1000; // 60 min

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

function normalizeText(value) {
  return safeText(value).trim();
}

function isFresh(record) {
  const ts = Number(record?.updatedAtMs || record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= ACTIVE_DOCUMENT_CONTEXT_WINDOW_MS;
}

export function saveActiveDocumentContext({
  chatId,
  fileName = "",
  title = "",
  text = "",
  source = "",
  meta = {},
}) {
  const key = String(chatId || "").trim();
  const normalizedText = normalizeText(text);

  if (!key || !normalizedText) return null;

  const existing = ACTIVE_DOCUMENT_CONTEXT_CACHE.get(key) || null;

  const record = {
    chatId: key,
    fileName: normalizeText(fileName),
    title: normalizeText(title),
    text: normalizedText,
    source: normalizeText(source) || "unknown",
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: existing?.createdAt || nowIso(),
    createdAtMs: Number(existing?.createdAtMs || 0) || nowMs(),
    updatedAt: nowIso(),
    updatedAtMs: nowMs(),
  };

  ACTIVE_DOCUMENT_CONTEXT_CACHE.set(key, record);
  return record;
}

export function getActiveDocumentContext(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;

  const record = ACTIVE_DOCUMENT_CONTEXT_CACHE.get(key) || null;
  if (!record) return null;

  if (!isFresh(record)) {
    ACTIVE_DOCUMENT_CONTEXT_CACHE.delete(key);
    return null;
  }

  return record;
}

export function clearActiveDocumentContext(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return ACTIVE_DOCUMENT_CONTEXT_CACHE.delete(key);
}

export default {
  saveActiveDocumentContext,
  getActiveDocumentContext,
  clearActiveDocumentContext,
};