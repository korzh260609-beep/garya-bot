// src/services/chatMemory/index.js
// Stage 7B foundation helper
// NOTE:
// - aligned to ESM
// - aligned to current runtime chat_messages schema
// - internal foundation store lives in ./chatMessagesStore.js
// - public/runtime API must stay in src/db/chatMessagesRepo.js

import { buildStoredMessage } from "./buildStoredMessage.js";
import { insertChatMessage } from "./chatMessagesStore.js";

export async function saveIncomingMessage(payload = {}) {
  const message = buildStoredMessage({
    ...payload,
    role: "user",
  });

  if (!message.chatId) {
    throw new Error("saveIncomingMessage: chatId is required");
  }

  if (!message.transport) {
    throw new Error("saveIncomingMessage: transport is required");
  }

  if (message.messageId === null || message.messageId === undefined) {
    throw new Error("saveIncomingMessage: messageId is required");
  }

  return insertChatMessage(message);
}

export async function saveOutgoingMessage(payload = {}) {
  const message = buildStoredMessage({
    ...payload,
    role: "assistant",
  });

  if (!message.chatId) {
    throw new Error("saveOutgoingMessage: chatId is required");
  }

  if (!message.transport) {
    throw new Error("saveOutgoingMessage: transport is required");
  }

  return insertChatMessage(message);
}