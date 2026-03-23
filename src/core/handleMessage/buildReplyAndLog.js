// src/core/handleMessage/buildReplyAndLog.js

import { insertAssistantMessage } from "../../db/chatMessagesRepo.js";
import { redactText, sha256Text } from "../redaction.js";
import { truncateForDb } from "./shared.js";

export function buildReplyAndLog({
  deps,
  context,
  transport,
  chatIdStr,
  chatType,
  globalUserId,
  senderId,
  messageId,
}) {
  return async (message, meta = {}) => {
    const out = String(message ?? "");

    try {
      await deps.reply(context, out);
    } catch (e) {
      console.error("replyAndLog: deps.reply failed:", e);
    }

    try {
      const red = redactText(out);
      const { text: content, truncated } = truncateForDb(red);
      const textHash = sha256Text(red);

      await insertAssistantMessage({
        transport,
        chatId: chatIdStr,
        chatType,
        globalUserId: globalUserId || null,
        textHash,
        content,
        truncated,
        metadata: {
          ...meta,
          stage: "7B.command.reply",
          cmd: meta?.cmd || null,
          senderId,
          chatId: chatIdStr,
          messageId: messageId ? Number(messageId) : null,
        },
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("replyAndLog: insertAssistantMessage failed (fail-open):", e);
    }
  };
}