// src/core/transportMeta.js
// STAGE 6.4 — single place to derive chatType/isPrivateChat from transport context

export function deriveChatMeta(context = {}) {
  const transport = String(context?.transport || "unknown");

  const chatId = context?.chatId == null ? "" : String(context.chatId);
  const senderId = context?.senderId == null ? "" : String(context.senderId);

  // raw chat type as provided by transport (telegram: "private"/"group"/"supergroup"/"channel")
  const transportChatType =
    context?.transportChatType != null
      ? String(context.transportChatType)
      : context?.chatType != null
        ? String(context.chatType)
        : "";

  const chatType = transportChatType || "unknown";

  // conservative defaults; transport-specific rules live here
  let isPrivateChat = false;

  if (transport === "telegram") {
    // Telegram private chats: chat.type === "private"
    // Edge updates: sometimes chat.type missing, fallback chatId === from.id
    isPrivateChat = chatType === "private" || (chatId && senderId && chatId === senderId);
  } else {
    // Generic heuristic for other transports (future adapters)
    const t = chatType.toLowerCase();
    isPrivateChat = t === "dm" || t === "direct" || t === "direct_message" || t === "private";
  }

  return {
    chatType,
    isPrivateChat,
    transportChatType: transportChatType || null,
  };
}

export default deriveChatMeta;
