/**
 * UnifiedContext — transport-agnostic message envelope (Stage 6.2 SKELETON)
 *
 * Goal:
 *   One normalized shape for any transport (Telegram now, later Discord/Web/Email).
 *
 * IMPORTANT:
 *   Contract only. Not wired into production flow yet.
 */

// ✅ Stage 6.6 — ADDITIVE normalization helpers (no prod behavior change)
// We keep legacy `chatType` behavior ("unknown") for backward compatibility,
// and add normalized/raw fields for future enforced routing.
function normalizeChatType(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s === "unknown") return null;
  return s;
}

export function createUnifiedContext({
  transport,
  chatId,
  senderId,
  chatType,
  isPrivate,
  text,
  raw,
  meta,
} = {}) {
  const chatTypeRaw = chatType == null ? null : String(chatType);
  const chatTypeNormalized = normalizeChatType(chatTypeRaw);

  return {
    transport: String(transport || "unknown"),
    chatId: chatId == null ? null : String(chatId),
    senderId: senderId == null ? null : String(senderId),

    // Legacy field (keep as-is): string, default "unknown"
    chatType: String(chatType || "unknown"),

    // ✅ New additive fields (future-safe)
    chatTypeRaw, // may be null
    chatTypeNormalized, // null if empty/unknown, else normalized lower-case

    isPrivate: Boolean(isPrivate),
    text: typeof text === "string" ? text : "",
    raw: raw ?? null,
    meta: meta && typeof meta === "object" ? { ...meta } : {}, // reserved (threadId, locale, messageId, etc.)
  };
}
