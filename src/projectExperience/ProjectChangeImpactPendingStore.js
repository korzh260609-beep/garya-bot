// src/projectExperience/ProjectChangeImpactPendingStore.js
// ============================================================================
// STAGE C.6B — Project Change Impact Pending Store (STRICT MODE SKELETON)
// Purpose:
// - keep pending high-risk change commands until monarch confirms risk
// - support strict pre-change guard without executing dangerous actions immediately
// IMPORTANT:
// - in-memory only for now
// - Render restart clears pending confirmations
// - NO DB writes
// - NO Project Memory writes
// ============================================================================

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const store = new Map();

function safeText(value) {
  return String(value ?? "").trim();
}

function makeKey({ transport = "telegram", chatId, globalUserId } = {}) {
  return [safeText(transport) || "telegram", safeText(chatId), safeText(globalUserId)].join(":");
}

function nowMs() {
  return Date.now();
}

function pruneExpired() {
  const t = nowMs();

  for (const [key, value] of store.entries()) {
    if (!value || value.expiresAt <= t) {
      store.delete(key);
    }
  }
}

export function savePendingChangeImpact({
  transport = "telegram",
  chatId,
  globalUserId,
  cmd,
  rest = "",
  impact = null,
  ttlMs = DEFAULT_TTL_MS,
} = {}) {
  pruneExpired();

  const key = makeKey({ transport, chatId, globalUserId });
  const createdAt = nowMs();

  const payload = {
    transport: safeText(transport) || "telegram",
    chatId: safeText(chatId),
    globalUserId: safeText(globalUserId),
    cmd: safeText(cmd),
    rest: safeText(rest),
    impact,
    createdAt,
    expiresAt: createdAt + Math.max(1000, Number(ttlMs) || DEFAULT_TTL_MS),
  };

  store.set(key, payload);
  return payload;
}

export function getPendingChangeImpact({ transport = "telegram", chatId, globalUserId } = {}) {
  pruneExpired();
  const key = makeKey({ transport, chatId, globalUserId });
  return store.get(key) || null;
}

export function consumePendingChangeImpact({ transport = "telegram", chatId, globalUserId } = {}) {
  pruneExpired();
  const key = makeKey({ transport, chatId, globalUserId });
  const value = store.get(key) || null;
  if (value) store.delete(key);
  return value;
}

export function clearPendingChangeImpact({ transport = "telegram", chatId, globalUserId } = {}) {
  const key = makeKey({ transport, chatId, globalUserId });
  return store.delete(key);
}

export default {
  savePendingChangeImpact,
  getPendingChangeImpact,
  consumePendingChangeImpact,
  clearPendingChangeImpact,
};
