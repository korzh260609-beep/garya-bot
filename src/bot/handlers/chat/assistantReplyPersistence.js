// src/bot/handlers/chat/assistantReplyPersistence.js

import { insertAssistantMessage } from "../../../db/chatMessagesRepo.js";
import { touchChatMeta } from "../../../db/chatMeta.js";
import { redactText, sha256Text } from "../../../core/redaction.js";

export function createAssistantReplyPersistence({
  MAX_CHAT_MESSAGE_CHARS,
  chatIdStr,
  senderIdStr,
  messageId,
  globalUserId,
  msg,
  memoryWrite,
}) {
  const buildAssistantDbPayload = (replyText, metadata = {}) => {
    const transport = "telegram";
    const chatType = msg?.chat?.type || null;

    const assistantRedactedFull = redactText(replyText);
    const assistantTextHash = sha256Text(assistantRedactedFull);

    const assistantContentForDb =
      typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS
        ? assistantRedactedFull.slice(0, MAX_CHAT_MESSAGE_CHARS)
        : typeof assistantRedactedFull === "string"
          ? assistantRedactedFull
          : "";

    const assistantTruncatedForDb =
      typeof assistantRedactedFull === "string" && assistantRedactedFull.length > MAX_CHAT_MESSAGE_CHARS;

    return {
      transport,
      chatType,
      textHash: assistantTextHash,
      content: assistantContentForDb,
      truncated: Boolean(assistantTruncatedForDb),
      metadata: {
        senderIdStr,
        chatIdStr,
        in_reply_to_message_id: messageId ?? null,
        globalUserId: globalUserId ?? null,
        handler: "chat",
        ...metadata,
      },
      schemaVersion: 1,
    };
  };

  const insertAssistantReply = async (replyText, metadata = {}) => {
    const payload = buildAssistantDbPayload(replyText, metadata);

    await insertAssistantMessage({
      transport: payload.transport,
      chatId: chatIdStr,
      chatType: payload.chatType,
      globalUserId: globalUserId || null,
      textHash: payload.textHash,
      content: payload.content,
      truncated: payload.truncated,
      metadata: payload.metadata,
      schemaVersion: payload.schemaVersion,
    });
  };

  const touchAssistantChatMeta = async () => {
    try {
      await touchChatMeta({
        transport: "telegram",
        chatId: String(chatIdStr),
        chatType: msg?.chat?.type || null,
        title: msg?.chat?.title || null,
        role: "assistant",
      });
    } catch (_) {}
  };

  const saveAssistantEarlyReturn = async (text, reason = "early_return") => {
    try {
      const replyText = typeof text === "string" ? text : String(text || "");
      if (!replyText.trim()) return;

      try {
        await insertAssistantReply(replyText, {
          earlyReturn: true,
          reason,
          stage: "7B.early_return",
        });
      } catch (e) {
        console.error("ERROR STAGE 7B early-return assistant insert failed (fail-open):", e);
      }

      await memoryWrite({
        role: "assistant",
        content: replyText,
        transport: "telegram",
        metadata: {
          senderIdStr,
          chatIdStr,
          messageId,
          earlyReturn: true,
          reason,
        },
        schemaVersion: 2,
      });
    } catch (e) {
      console.error("ERROR saveAssistantEarlyReturn error:", e);
    }
  };

  return {
    insertAssistantReply,
    touchAssistantChatMeta,
    saveAssistantEarlyReturn,
  };
}