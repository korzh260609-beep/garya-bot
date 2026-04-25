// src/projectExperience/PendingProjectActionStore.js
// ============================================================================
// STAGE C.6C — Pending Project Action Store (TRANSPORT-AGNOSTIC SKELETON)
// Purpose:
// - store pending risky project actions independently from Telegram commands
// - support natural confirmation/cancel intents across transports
// - keep strict guard generic: action waits until explicit confirmation intent
// IMPORTANT:
// - in-memory only for now
// - Render restart clears pending confirmations
// - NO DB writes
// - NO Project Memory writes
// - transport-agnostic: transport/chatId/globalUserId are just scope keys
// ============================================================================

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const store = new Map();

function safeText(value) {
  return String(value ?? "").trim();
}

function nowMs() {
  return Date.now();
}

function makeKey({ transport = "unknown", chatId, globalUserId } = {}) {
  return [safeText(transport) || "unknown", safeText(chatId), safeText(globalUserId)].join(":");
}

function pruneExpired() {
  const t = nowMs();

  for (const [key, value] of store.entries()) {
    if (!value || value.expiresAt <= t) {
      store.delete(key);
    }
  }
}

export function savePendingProjectAction({
  transport = "unknown",
  chatId,
  globalUserId,
  actionType = "unknown",
  actionPayload = {},
  impact = null,
  confirmationPolicy = "strict",
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  pruneExpired();

  const key = makeKey({ transport, chatId, globalUserId });
  const createdAt = nowMs();

  const pending = {
    transport: safeText(transport) || "unknown",
    chatId: safeText(chatId),
    globalUserId: safeText(globalUserId),
    actionType: safeText(actionType) || "unknown",
    actionPayload:
      actionPayload && typeof actionPayload === "object" && !Array.isArray(actionPayload)
        ? actionPayload
        : {},
    impact,
    confirmationPolicy: safeText(confirmationPolicy) || "strict",
    createdAt,
    expiresAt: createdAt + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS),
  };

  store.set(key, pending);
  return pending;
}

export function getPendingProjectAction({ transport = "unknown", chatId, globalUserId } = {}) {
  pruneExpired();
  const key = makeKey({ transport, chatId, globalUserId });
  return store.get(key) || null;
}

export function consumePendingProjectAction({ transport = "unknown", chatId, globalUserId } = {}) {
  pruneExpired();
  const key = makeKey({ transport, chatId, globalUserId });
  const value = store.get(key) || null;
  if (value) store.delete(key);
  return value;
}

export function clearPendingProjectAction({ transport = "unknown", chatId, globalUserId } = {}) {
  const key = makeKey({ transport, chatId, globalUserId });
  return store.delete(key);
}

export default {
  savePendingProjectAction,
  getPendingProjectAction,
  consumePendingProjectAction,
  clearPendingProjectAction,
};
