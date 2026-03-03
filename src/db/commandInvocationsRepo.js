// src/db/commandInvocationsRepo.js
// STAGE 6.8.2 — COMMAND IDEMPOTENCY (DB guard)
// Insert-first with ON CONFLICT DO NOTHING.
// Returns: { inserted: true } | { inserted: false, reason: "duplicate" }

import pool from "../../db.js";

export async function insertCommandInvocation({
  transport,
  chatId,
  messageId,
  cmd,
  globalUserId = null,
  senderId = null,
  metadata = {},
}) {
  const res = await pool.query(
    `
    INSERT INTO command_invocations
      (transport, chat_id, message_id, cmd, global_user_id, sender_id, metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (transport, chat_id, message_id) DO NOTHING
    RETURNING id
    `,
    [
      String(transport),
      String(chatId),
      Number(messageId),
      String(cmd),
      globalUserId ? String(globalUserId) : null,
      senderId ? String(senderId) : null,
      JSON.stringify(metadata || {}),
    ]
  );

  if (!res || (res.rowCount || 0) === 0) {
    return { inserted: false, reason: "duplicate" };
  }

  return { inserted: true, id: res.rows?.[0]?.id ?? null };
}
