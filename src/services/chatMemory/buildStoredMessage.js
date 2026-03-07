// src/services/chatMemory/buildStoredMessage.js
// Stage 7B foundation helper
// NOTE:
// - aligned to current runtime schema
// - stores only redacted content in chat_messages

import { redactMessage } from "./redactMessage.js";
import { normalizeMessageForStorage } from "./normalizeMessageForStorage.js";
import { computeTextHash } from "./computeTextHash.js";

export function buildStoredMessage(payload = {}) {
  const rawInput = payload.content ?? payload.textRaw ?? "";

  const redactionPolicy =
    payload.redactionPolicy && typeof payload.redactionPolicy === "object"
      ? payload.redactionPolicy
      : payload?.metadata?.redactionPolicy &&
          typeof payload.metadata.redactionPolicy === "object"
        ? payload.metadata.redactionPolicy
        : {};

  const redacted = redactMessage(rawInput, redactionPolicy);
  const normalized = normalizeMessageForStorage(redacted);

  return {
    chatId: payload.chatId ? String(payload.chatId) : null,
    transport: payload.transport ? String(payload.transport) : null,
    chatType: payload.chatType ? String(payload.chatType) : null,
    globalUserId: payload.globalUserId ? String(payload.globalUserId) : null,
    senderId: payload.senderId ? String(payload.senderId) : null,

    messageId:
      payload.messageId === null || payload.messageId === undefined || payload.messageId === ""
        ? null
        : Number(payload.messageId),

    platformMessageId:
      payload.platformMessageId === null ||
      payload.platformMessageId === undefined ||
      payload.platformMessageId === ""
        ? (payload.messageId === null || payload.messageId === undefined || payload.messageId === ""
            ? null
            : Number(payload.messageId))
        : Number(payload.platformMessageId),

    role: payload.role ? String(payload.role) : null,
    content: normalized.text,
    textHash: computeTextHash(normalized.text),
    truncated: normalized.truncated,
    metadata:
      payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
    raw: payload.raw && typeof payload.raw === "object" ? payload.raw : {},
    schemaVersion: Number.isInteger(payload.schemaVersion) ? payload.schemaVersion : 1,
  };
}