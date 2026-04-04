// src/bot/handlers/chat/activeDocumentExportTargetCache.js
// ============================================================================
// STAGE 12A.2 — ACTIVE DOCUMENT EXPORT TARGET CACHE
// Purpose:
// - keep last actively discussed/exported document target per chat
// - targets:
//   1) summary
//   2) full_text
//   3) current_part
//   4) assistant_answer_about_document
// - used only for target=auto resolution
// - no DB
// ============================================================================

const ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE = new Map();
const ACTIVE_DOCUMENT_EXPORT_TARGET_WINDOW_MS = 30 * 60 * 1000; // 30 min

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

function normalizeTarget(value) {
  const src = safeText(value).trim().toLowerCase();

  if (src === "summary") return "summary";
  if (src === "full_text") return "full_text";
  if (src === "current_part") return "current_part";
  if (src === "assistant_answer_about_document") {
    return "assistant_answer_about_document";
  }

  return "";
}

function isFresh(record) {
  const ts = Number(record?.updatedAtMs || record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= ACTIVE_DOCUMENT_EXPORT_TARGET_WINDOW_MS;
}

export function saveActiveDocumentExportTarget({
  chatId,
  target,
  meta = {},
}) {
  const key = String(chatId || "").trim();
  const normalizedTarget = normalizeTarget(target);

  if (!key || !normalizedTarget) return null;

  const existing = ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE.get(key) || null;

  const record = {
    chatId: key,
    target: normalizedTarget,
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: existing?.createdAt || nowIso(),
    createdAtMs: Number(existing?.createdAtMs || 0) || nowMs(),
    updatedAt: nowIso(),
    updatedAtMs: nowMs(),
  };

  ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE.set(key, record);
  return record;
}

export function getActiveDocumentExportTarget(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;

  const record = ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE.get(key) || null;
  if (!record) return null;

  if (!isFresh(record)) {
    ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE.delete(key);
    return null;
  }

  return record;
}

export function clearActiveDocumentExportTarget(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return ACTIVE_DOCUMENT_EXPORT_TARGET_CACHE.delete(key);
}

export default {
  saveActiveDocumentExportTarget,
  getActiveDocumentExportTarget,
  clearActiveDocumentExportTarget,
};