// src/bot/handlers/chat/activeExportSourceCache.js
// ============================================================================
// STAGE 12A.2 — ACTIVE EXPORT SOURCE CACHE
// Purpose:
// - keep last active export source per chat
// - sources:
//   1) document
//   2) assistant_reply
// - used only for sourceKind=auto resolution
// - no DB
// ============================================================================

const ACTIVE_EXPORT_SOURCE_CACHE = new Map();
const ACTIVE_EXPORT_SOURCE_WINDOW_MS = 30 * 60 * 1000; // 30 min

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

function normalizeSourceKind(value) {
  const src = safeText(value).trim().toLowerCase();

  if (src === "document") return "document";
  if (src === "assistant_reply") return "assistant_reply";

  return "";
}

function isFresh(record) {
  const ts = Number(record?.updatedAtMs || record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= ACTIVE_EXPORT_SOURCE_WINDOW_MS;
}

export function saveActiveExportSource({
  chatId,
  sourceKind,
  meta = {},
}) {
  const key = String(chatId || "").trim();
  const normalizedSourceKind = normalizeSourceKind(sourceKind);

  if (!key || !normalizedSourceKind) return null;

  const existing = ACTIVE_EXPORT_SOURCE_CACHE.get(key) || null;

  const record = {
    chatId: key,
    sourceKind: normalizedSourceKind,
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: existing?.createdAt || nowIso(),
    createdAtMs: Number(existing?.createdAtMs || 0) || nowMs(),
    updatedAt: nowIso(),
    updatedAtMs: nowMs(),
  };

  ACTIVE_EXPORT_SOURCE_CACHE.set(key, record);
  return record;
}

export function getActiveExportSource(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;

  const record = ACTIVE_EXPORT_SOURCE_CACHE.get(key) || null;
  if (!record) return null;

  if (!isFresh(record)) {
    ACTIVE_EXPORT_SOURCE_CACHE.delete(key);
    return null;
  }

  return record;
}

export function clearActiveExportSource(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return ACTIVE_EXPORT_SOURCE_CACHE.delete(key);
}

export default {
  saveActiveExportSource,
  getActiveExportSource,
  clearActiveExportSource,
};