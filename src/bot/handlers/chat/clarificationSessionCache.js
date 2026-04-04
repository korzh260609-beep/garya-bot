// src/bot/handlers/chat/clarificationSessionCache.js
// ============================================================================
// STAGE 12A.2 — CLARIFICATION SESSION CACHE
// Purpose:
// - store pending clarification state per chat
// - current scope:
//   1) export_source
//   2) document_export_target
//   3) document_estimate_source
//   4) document_estimate_followup_detail
//   5) document_part_request
// - no DB
// - no AI
// ============================================================================

const CLARIFICATION_SESSION_CACHE = new Map();
const CLARIFICATION_SESSION_WINDOW_MS = 15 * 60 * 1000; // 15 min

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

function normalizeKind(value) {
  const src = safeText(value).trim().toLowerCase();

  if (src === "export_source") return "export_source";
  if (src === "document_export_target") return "document_export_target";
  if (src === "document_estimate_source") return "document_estimate_source";
  if (src === "document_estimate_followup_detail") {
    return "document_estimate_followup_detail";
  }
  if (src === "document_part_request") return "document_part_request";

  return "";
}

function isFresh(record) {
  const ts = Number(record?.createdAtMs || 0);
  if (!ts) return false;
  return nowMs() - ts <= CLARIFICATION_SESSION_WINDOW_MS;
}

export function savePendingClarification({
  chatId,
  kind,
  question = "",
  payload = {},
}) {
  const key = String(chatId || "").trim();
  const normalizedKind = normalizeKind(kind);

  if (!key || !normalizedKind) return null;

  const record = {
    kind: normalizedKind,
    question: safeText(question).trim(),
    payload: payload && typeof payload === "object" ? payload : {},
    createdAt: nowIso(),
    createdAtMs: nowMs(),
  };

  CLARIFICATION_SESSION_CACHE.set(key, record);
  return record;
}

export function getPendingClarification(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return null;

  const record = CLARIFICATION_SESSION_CACHE.get(key) || null;
  if (!record) return null;

  if (!isFresh(record)) {
    CLARIFICATION_SESSION_CACHE.delete(key);
    return null;
  }

  return record;
}

export function clearPendingClarification(chatId) {
  const key = String(chatId || "").trim();
  if (!key) return false;
  return CLARIFICATION_SESSION_CACHE.delete(key);
}

export default {
  savePendingClarification,
  getPendingClarification,
  clearPendingClarification,
};