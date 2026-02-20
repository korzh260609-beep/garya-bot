/**
 * UnifiedContext — transport-agnostic message envelope (Stage 6.2 SKELETON)
 *
 * Goal:
 *   One normalized shape for any transport (Telegram now, later Discord/Web/Email).
 *
 * IMPORTANT:
 *   Contract only. Not wired into production flow yet.
 */

export function createUnifiedContext({
  transport,
  chatId,
  senderId,
  chatType,
  isPrivate,
  text,
  raw,
} = {}) {
  return {
    transport: String(transport || "unknown"),
    chatId: chatId == null ? null : String(chatId),
    senderId: senderId == null ? null : String(senderId),
    chatType: String(chatType || "unknown"),
    isPrivate: Boolean(isPrivate),
    text: typeof text === "string" ? text : "",
    raw: raw ?? null,
    meta: {}, // reserved (threadId, locale, messageId, etc.)
  };
}
