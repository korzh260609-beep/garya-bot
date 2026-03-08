// src/services/chatMemory/guardIncomingChatMessage.js
// STAGE 7B.7 helper
// Extracted from handlers/chat.js
// Purpose:
// - provide insert-first idempotency guard for inbound chat messages
// - guarantee process-once semantics for Telegram webhook retries
//
// Rules:
// - DO NOT break runtime flow
// - fail-open on any error
// - no schema changes
// - no logging side-effects here (handler decides)

import { insertUserMessage } from "../../db/chatMessagesRepo.js";

export async function guardIncomingChatMessage(payload) {
  try {
    const res = await insertUserMessage(payload);

    if (!res || res.inserted !== true) {
      return {
        duplicate: true,
      };
    }

    return {
      duplicate: false,
      id: res?.id ?? null,
    };
  } catch (e) {
    // fail-open — never break production flow
    console.error("guardIncomingChatMessage failed (fail-open):", e);

    return {
      duplicate: false,
      failOpen: true,
    };
  }
}