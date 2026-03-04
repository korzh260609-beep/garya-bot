// src/transport/toCoreContext.js
// Stage 6 — SKELETON
// Purpose: convert UnifiedContext (transport layer) → Core handleMessage(context) shape
// IMPORTANT:
// - No side-effects
// - Does NOT decide privacy/chat meta (core derives it)
// - Keep fields compatible with current SHADOW call in messageRouter

export function toCoreContextFromUnified(unified = {}, extra = {}) {
  const transport = String(unified?.transport || extra?.transport || "unknown");

  const chatId = unified?.chatId == null ? null : String(unified.chatId);

  const senderId =
    unified?.senderId == null ? null : String(unified.senderId);

  const text = typeof unified?.text === "string" ? unified.text : "";

  const transportChatType =
    extra?.transportChatTypeOverride != null
      ? String(extra.transportChatTypeOverride)
      : unified?.chatType != null
        ? String(unified.chatType)
        : null;

  const messageId = extra?.messageId == null ? null : String(extra.messageId);

  const globalUserId =
    extra?.globalUserId == null ? null : String(extra.globalUserId);

  // --------------------------------------------------------------------------
  // NEW: universal event id (future-proof architecture)
  // --------------------------------------------------------------------------

  let eventId = null;

  if (unified?.eventId) {
    eventId = String(unified.eventId);
  } else if (transport && chatId && messageId) {
    eventId = `${transport}:${chatId}:${messageId}`;
  }

  // --------------------------------------------------------------------------
  // Backward compatibility (Stage 6)
  // --------------------------------------------------------------------------

  const dedupeKey = eventId;

  return {
    transport,
    chatId,
    senderId,
    transportChatType,
    text,
    messageId,
    globalUserId,

    // NEW universal id
    eventId,

    // legacy (used by current Stage 6 guards)
    dedupeKey
  };
}

export default toCoreContextFromUnified;
