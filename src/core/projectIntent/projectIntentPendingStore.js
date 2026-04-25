// src/core/projectIntent/projectIntentPendingStore.js
// ============================================================================
// STAGE 12A.0 — Project Intent Pending Store
// Purpose:
// - store SG-core write intent pending confirmations
// - use global user identity + transport chat scope
// - keep this as a small in-memory skeleton before DB-backed implementation
// - no action execution here
// ============================================================================

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const pendingByKey = new Map();

function safeText(value) {
  return String(value ?? "").trim();
}

function nowMs() {
  return Date.now();
}

function buildPendingKey({ globalUserId, chatId, transport } = {}) {
  const g = safeText(globalUserId);
  const c = safeText(chatId);
  const t = safeText(transport) || "unknown";

  if (!g || !c) return null;
  return `${t}:${c}:${g}`;
}

function cleanupExpired(now = nowMs()) {
  for (const [key, item] of pendingByKey.entries()) {
    if (!item || Number(item.expiresAt) <= now) {
      pendingByKey.delete(key);
    }
  }
}

export function savePendingProjectIntent({
  globalUserId,
  chatId,
  transport = "unknown",
  text = "",
  route = null,
  routePreview = null,
  match = null,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  cleanupExpired();

  const key = buildPendingKey({ globalUserId, chatId, transport });
  if (!key) {
    return { ok: false, reason: "missing_scope" };
  }

  const createdAt = nowMs();
  const expiresAt = createdAt + Math.max(30_000, Number(ttlMs) || DEFAULT_TTL_MS);

  const pending = {
    key,
    globalUserId: safeText(globalUserId),
    chatId: safeText(chatId),
    transport: safeText(transport) || "unknown",
    text: safeText(text),
    route,
    routePreview,
    match,
    createdAt,
    expiresAt,
    status: "pending",
  };

  pendingByKey.set(key, pending);

  return { ok: true, pending };
}

export function getPendingProjectIntent({
  globalUserId,
  chatId,
  transport = "unknown",
} = {}) {
  cleanupExpired();

  const key = buildPendingKey({ globalUserId, chatId, transport });
  if (!key) return null;

  return pendingByKey.get(key) || null;
}

export function consumePendingProjectIntent({
  globalUserId,
  chatId,
  transport = "unknown",
} = {}) {
  cleanupExpired();

  const key = buildPendingKey({ globalUserId, chatId, transport });
  if (!key) return null;

  const pending = pendingByKey.get(key) || null;
  if (pending) {
    pendingByKey.delete(key);
  }

  return pending;
}

export function clearPendingProjectIntent({
  globalUserId,
  chatId,
  transport = "unknown",
} = {}) {
  cleanupExpired();

  const key = buildPendingKey({ globalUserId, chatId, transport });
  if (!key) return false;

  return pendingByKey.delete(key);
}

export default {
  savePendingProjectIntent,
  getPendingProjectIntent,
  consumePendingProjectIntent,
  clearPendingProjectIntent,
};
