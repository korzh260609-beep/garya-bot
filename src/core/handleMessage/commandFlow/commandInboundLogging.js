// src/core/handleMessage/commandFlow/commandInboundLogging.js

import { insertUserMessage } from "../../../db/chatMessagesRepo.js";
import { redactText, sha256Text, buildRawMeta } from "../../redaction.js";
import { buildInboundStorageText } from "../inboundBinary.js";
import { truncateForDb } from "../shared.js";

export async function logInboundCommandMessage({
  transport,
  chatIdStr,
  chatType,
  globalUserId,
  senderId,
  messageId,
  raw,
  trimmed,
  cmdBase,
  commandInvocationInserted,
}) {
  try {
    if (commandInvocationInserted && transport === "telegram" && chatIdStr && messageId) {
      const inboundStorage = buildInboundStorageText(trimmed, raw);
      const red = redactText(inboundStorage.content);
      const { text: content, truncated } = truncateForDb(red);
      const textHash = sha256Text(red);

      await insertUserMessage({
        transport,
        chatId: chatIdStr,
        chatType,
        globalUserId: globalUserId || null,
        senderId: senderId || null,
        messageId: Number(messageId),
        textHash,
        content,
        truncated,
        metadata: {
          stage: "7B.command.in",
          cmd: cmdBase,
          senderId,
          chatId: chatIdStr,
          messageId: Number(messageId),
          hasBinaryAttachment: inboundStorage.hasBinaryAttachment,
          attachmentKinds: inboundStorage.attachmentKinds,
        },
        raw: buildRawMeta(raw || {}),
        schemaVersion: 1,
      });
    }
  } catch (e) {
    console.error("STAGE 7B command insertUserMessage failed (fail-open):", e);
  }
}