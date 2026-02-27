// src/db/chatRepo.js
// Stage 4 — Chats skeleton repo (transport-level)

import pool from "../../db.js";

export async function upsertChat({
  chatId,
  transport = "telegram",
  chatType = null,
  title = null,
  lastSeenAt = null,
  meta = null,
}) {
  // Skeleton only: used later by messageRouter (not wired yet)
  const res = await pool.query(
    `
    INSERT INTO chats (chat_id, transport, chat_type, title, last_seen_at, meta, updated_at)
    VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), NOW())
    ON CONFLICT (chat_id)
    DO UPDATE SET
      transport = EXCLUDED.transport,
      chat_type = EXCLUDED.chat_type,
      title = EXCLUDED.title,
      last_seen_at = COALESCE(EXCLUDED.last_seen_at, chats.last_seen_at),
      meta = COALESCE(EXCLUDED.meta, chats.meta),
      updated_at = NOW()
    RETURNING chat_id
    `,
    [String(chatId), String(transport), chatType, title, lastSeenAt, meta ? JSON.stringify(meta) : null]
  );

  return res.rows?.[0] || null;
}
