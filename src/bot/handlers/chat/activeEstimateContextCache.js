// src/bot/handlers/chat/activeEstimateContextCache.js
// ============================================================================
// STAGE 12A.2 — ACTIVE ESTIMATE CONTEXT CACHE
// Purpose:
// - keep last successful document estimate context per chat
// - allow semantic follow-up after estimate reply
// - no DB
// - no exact-phrase binding
// ============================================================================

const ACTIVE_ESTIMATE_CONTEXT_CACHE = new Map();
const ACTIVE_ESTIMATE_CONTEXT_WINDOW_MS = 30 * 60 * 1000; // 30 min

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

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeParts(parts) {
  if (!Array.isArray(parts)) return [];

  return parts
    .map((part) => ({
      partNumber: normalizeNumber(part?.partNumber, 0),
      charCount: normalizeNumber(part?.charCount, 0),
      startsWith: normalizeText(part?.startsWith),
    }))
    .filter((part) => part.partNumber > 0 && part.charCount > 0);
}

function isFresh(record) {
  const ts = Number(record?.updatedAtMs || record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= ACTIVE_ESTIMATE_CONTEXT_WINDOW_MS;
}

export function saveActiveEstimateContext({ chatId, estimate, meta = {} }) {
  const key = String(chatId || "").trim();
  if (!key || !estimate || typeof estimate !== "object") return null;

  const fileName = normalizeText(estimate?.fileName || "document");
  const parts = normalizeParts(estimate?.parts);

  const existing = ACTIVE_ESTIMATE_CONTEXT_CACHE.get(key) || null;

  const record = {
    chatId: key,

    estimate: {
      ok: true,
      fileName: fileName || "document",
      chunkSize: normalizeNumber(estimate?.chunkSize, 0),
      chunkCount: normalizeNumber(estimate?.chunkCount, 0),
      charCount: normalizeNumber(estimate?.charCount, 0),
      currentPartIndex: normalizeNumber(estimate?.currentPartIndex, 0),
      source: normalizeText(estimate?.source || "unknown") || "unknown",
      parts,
    },

    meta: meta && typeof meta === "object" ? meta : {},

    createdAt: existing?.createdAt || nowIso(),
    createdAtMs: Number(existing?.createdAtMs || 0) || nowMs(),
    updatedAt: nowIso(),
    updatedAtMs: nowMs(),
  };

  ACTIVE_ESTIMATE_CONTEXT_CACHE.set(key, record);
  return record;
}

export function getActiveEstimateContext(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;

  const record = ACTIVE_ESTIMATE_CONTEXT_CACHE.get(key) || null;
  if (!record) return null;

  if (!isFresh(record)) {
    ACTIVE_ESTIMATE_CONTEXT_CACHE.delete(key);
    return null;
  }

  return record;
}

export function clearActiveEstimateContext(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return ACTIVE_ESTIMATE_CONTEXT_CACHE.delete(key);
}

export default {
  saveActiveEstimateContext,
  getActiveEstimateContext,
  clearActiveEstimateContext,
};