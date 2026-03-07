// src/db/chatMessagesRepo.js
// STAGE 7B — runtime adapter over services/chatMemory foundation
// Purpose:
// - keep OLD runtime API stable for handlers/chat.js and messageRouter.js
// - delegate chat_messages writes to Stage 7B foundation service layer
// - keep webhook_dedupe_events write here (runtime DB adapter)
// Rules:
// - minimal safe integration
// - no abrupt runtime path rewrite
// - handlers still import from src/db/chatMessagesRepo.js

import pool from "../../db.js";
import {
  saveIncomingMessage,
  saveOutgoingMessage,
} from "../services/chatMemory/index.js";

// ============================================================================
// insertUserMessage
// Runtime-compatible wrapper over Stage 7B foundation.
// Input API preserved.
// Returns: { inserted: true, id } | { inserted: false, reason: "duplicate" }
// ============================================================================
export async function insertUserMessage({
  transport,
  chatId,
  chatType = null,
  globalUserId = null,
  senderId = null,
  messageId,
  textHash, // preserved for API compatibility; foundation recomputes from stored content
  content,
  truncated = false, // preserved for API compatibility; foundation normalizes again
  metadata = {},
  raw = {},
  schemaVersion = 1,
}) {
  try {
    const res = await saveIncomingMessage({
      transport,
      chatId: String(chatId),
      chatType: chatType ? String(chatType) : null,
      globalUserId: globalUserId ? String(globalUserId) : null,
      senderId: senderId ? String(senderId) : null,
      messageId: Number(messageId),
      platformMessageId: Number(messageId),
      role: "user",
      content,
      metadata: {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        _runtimeAdapter: "src/db/chatMessagesRepo.js",
        _legacyTextHash: textHash ?? null,
        _legacyTruncated: Boolean(truncated),
      },
      raw: raw && typeof raw === "object" ? raw : {},
      schemaVersion,
    });

    if (!res || res.duplicate === true) {
      return { inserted: false, reason: "duplicate" };
    }

    return {
      inserted: true,
      id: res?.row?.id ?? null,
    };
  } catch (e) {
    throw e;
  }
}

// ============================================================================
// insertAssistantMessage
// Runtime-compatible wrapper over Stage 7B foundation.
// Input API preserved.
// ============================================================================
export async function insertAssistantMessage({
  transport,
  chatId,
  chatType = null,
  globalUserId = null,
  textHash, // preserved for API compatibility; foundation recomputes from stored content
  content,
  truncated = false, // preserved for API compatibility; foundation normalizes again
  metadata = {},
  schemaVersion = 1,
}) {
  try {
    await saveOutgoingMessage({
      transport,
      chatId: String(chatId),
      chatType: chatType ? String(chatType) : null,
      globalUserId: globalUserId ? String(globalUserId) : null,
      senderId: null,
      messageId: null,
      platformMessageId: null,
      role: "assistant",
      content,
      metadata: {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        _runtimeAdapter: "src/db/chatMessagesRepo.js",
        _legacyTextHash: textHash ?? null,
        _legacyTruncated: Boolean(truncated),
      },
      raw: {},
      schemaVersion,
    });
  } catch (e) {
    throw e;
  }
}

// ============================================================================
// insertWebhookDedupeEvent
// Records a deduplicated webhook hit for observability.
// Kept in runtime DB layer because Stage 7B foundation currently covers
// chat_messages only.
// ============================================================================
export async function insertWebhookDedupeEvent({
  transport,
  chatId,
  messageId,
  globalUserId = null,
  reason = "retry_duplicate",
  metadata = {},
}) {
  await pool.query(
    `
    INSERT INTO webhook_dedupe_events
      (transport, chat_id, message_id, global_user_id, reason, metadata)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    ON CONFLICT (transport, chat_id, message_id) DO NOTHING
    `,
    [
      transport,
      String(chatId),
      Number(messageId),
      globalUserId ? String(globalUserId) : null,
      reason,
      JSON.stringify(metadata),
    ]
  );
}