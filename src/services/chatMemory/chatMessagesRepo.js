// src/services/chatMemory/chatMessagesRepo.js
// Stage 7B foundation helper
// INTERNAL-ONLY NOTE:
// - this file is NOT a runtime/public import target
// - handlers, router, runtime modules must NOT import this file directly
// - canonical runtime entry-point is: src/db/chatMessagesRepo.js
// - this file is allowed only for internal service/foundation usage
//
// NOTE:
// - aligned to current repo ESM style
// - aligned to real runtime chat_messages schema
// - NOT wired automatically into production flow yet

import pool from "../../../db.js";

const INSERT_SQL = `
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
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14
  )
  ON CONFLICT (transport, chat_id, message_id)
    WHERE role = 'user' AND message_id IS NOT NULL
  DO NOTHING
  RETURNING id, created_at
`;

export async function insertChatMessage(message) {
  const values = [
    message.transport,
    message.chatId,
    message.chatType,
    message.globalUserId,
    message.senderId,
    message.messageId,
    message.platformMessageId,
    message.textHash,
    message.role,
    message.content,
    Boolean(message.truncated),
    JSON.stringify(message.metadata || {}),
    JSON.stringify(message.raw || {}),
    Number.isInteger(message.schemaVersion) ? message.schemaVersion : 1,
  ];

  const result = await pool.query(INSERT_SQL, values);

  if (!result || (result.rowCount || 0) === 0) {
    return {
      ok: true,
      duplicate: true,
      row: null,
    };
  }

  return {
    ok: true,
    duplicate: false,
    row: result.rows?.[0] || null,
  };
}