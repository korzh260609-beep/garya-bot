// src/db/chatMessagesRepo.js
// STAGE 7.7.2 — Chat Messages DB layer
// Purpose: single place for all SQL touching chat_messages + webhook_dedupe_events.
// Handlers MUST NOT do direct pool.query on these tables.

import pool from "../../db.js";

// ============================================================================
// insertUserMessage
// Inserts incoming user message with idempotency (ON CONFLICT DO NOTHING).
// Returns: { inserted: true } | { inserted: false, reason: "duplicate" }
// ============================================================================
export async function insertUserMessage({
  transport,
  chatId,
  chatType = null,
  globalUserId = null,
  senderId = null,
  messageId,
  textHash,
  content,
  truncated = false,
  metadata = {},
  raw = {},
  schemaVersion = 1,
}) {
  const res = await pool.query(
    `
    INSERT INTO chat_messages (
      transport,
      chat_id,
      chat_type,
      global_user_id,
      sender_id,
      message_id,
      platform_message_id,
      text_hash,
      role,
      content,
      truncated,
      metadata,
      raw,
      schema_version
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
    ON CONFLICT (transport, chat_id, message_id)
      WHERE role='user' AND message_id IS NOT NULL
    DO NOTHING
    RETURNING id
    `,
    [
      transport,
      String(chatId),
      chatType ? String(chatType) : null,
      globalUserId ? String(globalUserId) : null,
      senderId ? String(senderId) : null,
      Number(messageId),
      Number(messageId),
      textHash,
      "user",
      content,
      Boolean(truncated),
      JSON.stringify(metadata),
      JSON.stringify(raw),
      schemaVersion,
    ]
  );

  if (!res || (res.rowCount || 0) === 0) {
    return { inserted: false, reason: "duplicate" };
  }

  return { inserted: true, id: res.rows?.[0]?.id ?? null };
}

// ============================================================================
// insertAssistantMessage
// Inserts outgoing assistant message (no idempotency key — assistant messages
// don't have a platform message_id at write time).
// ============================================================================
export async function insertAssistantMessage({
  transport,
  chatId,
  chatType = null,
  globalUserId = null,
  textHash,
  content,
  truncated = false,
  metadata = {},
  schemaVersion = 1,
}) {
  await pool.query(
    `
    INSERT INTO chat_messages (
      transport,
      chat_id,
      chat_type,
      global_user_id,
      sender_id,
      message_id,
      platform_message_id,
      text_hash,
      role,
      content,
      truncated,
      metadata,
      raw,
      schema_version
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
    `,
    [
      transport,
      String(chatId),
      chatType ? String(chatType) : null,
      globalUserId ? String(globalUserId) : null,
      null,
      null,
      null,
      textHash,
      "assistant",
      content,
      Boolean(truncated),
      JSON.stringify(metadata),
      JSON.stringify({}),
      schemaVersion,
    ]
  );
}

// ============================================================================
// insertWebhookDedupeEvent
// Records a deduplicated webhook hit for observability.
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