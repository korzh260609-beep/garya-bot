'use strict';

/*
  IMPORTANT:
  Replace the import below with your real DB accessor.
  Example:
  const db = require('../../db');
  or:
  const { query } = require('../../db/pg');
*/

const db = require('../../db'); // <-- adjust path if needed

const INSERT_SQL = `
  INSERT INTO chat_messages (
    chat_id,
    platform,
    platform_message_id,
    direction,
    user_id,
    role,
    text_raw,
    text_redacted,
    text_hash,
    truncated
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
  )
  RETURNING id, created_at
`;

async function insertChatMessage(message) {
  const values = [
    message.chatId,
    message.platform,
    message.platformMessageId,
    message.direction,
    message.userId,
    message.role,
    message.textRaw,
    message.textRedacted,
    message.textHash,
    message.truncated,
  ];

  try {
    const result = await db.query(INSERT_SQL, values);

    return {
      ok: true,
      duplicate: false,
      row: result.rows[0] || null,
    };
  } catch (error) {
    // PostgreSQL unique violation
    if (error && error.code === '23505') {
      return {
        ok: true,
        duplicate: true,
        row: null,
      };
    }

    throw error;
  }
}

module.exports = {
  insertChatMessage,
};