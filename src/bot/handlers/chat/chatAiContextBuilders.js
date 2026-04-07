// src/bot/handlers/chat/chatAiContextBuilders.js

export function buildSenderMemoryMeta(msg, chatIdStr, senderIdStr, messageId) {
  const firstName = String(msg?.from?.first_name || "").trim();
  const lastName = String(msg?.from?.last_name || "").trim();
  const username = String(msg?.from?.username || "").trim();
  const chatType = String(msg?.chat?.type || "").trim() || "unknown";
  const senderName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return {
    senderIdStr,
    chatIdStr,
    messageId,
    chatType,
    senderFirstName: firstName,
    senderLastName: lastName,
    senderUsername: username,
    senderName: senderName || (username ? `@${username}` : ""),
  };
}

export function buildAssistantMemoryMeta(msg, chatIdStr, messageId) {
  const chatType = String(msg?.chat?.type || "").trim() || "unknown";

  return {
    chatIdStr,
    messageId,
    chatType,
    assistantLabel: "sg_assistant",
  };
}

export function safeReplyText(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function buildReplyAuthorLabel(replyMsg) {
  const firstName = String(replyMsg?.from?.first_name || "").trim();
  const lastName = String(replyMsg?.from?.last_name || "").trim();
  const username = String(replyMsg?.from?.username || "").trim();

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (username) return username.startsWith("@") ? username : `@${username}`;
  return "unknown_user";
}

export function buildReplyContext(msg) {
  const replyMsg = msg?.reply_to_message;
  if (!replyMsg) return null;

  const replyText = safeReplyText(replyMsg?.text || replyMsg?.caption || "");
  const authorLabel = buildReplyAuthorLabel(replyMsg);
  const replyMessageId = replyMsg?.message_id ?? null;

  return {
    exists: true,
    authorLabel,
    replyMessageId,
    replyText,
  };
}

export function resolveHistoryLimit({
  currentChatType = "unknown",
  defaultLimit = 20,
}) {
  const chatType = String(currentChatType || "").trim().toLowerCase();

  if (chatType === "group" || chatType === "supergroup") {
    return Math.max(defaultLimit, 6);
  }

  return defaultLimit;
}

export default {
  buildSenderMemoryMeta,
  buildAssistantMemoryMeta,
  safeReplyText,
  buildReplyAuthorLabel,
  buildReplyContext,
  resolveHistoryLimit,
};
