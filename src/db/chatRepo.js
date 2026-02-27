// src/db/chatRepo.js
// Stage 4 — Chats repo (transport-level)

import pool from "../../db.js";

export async function upsertChat({
  chatId,
  transport = "telegram",
  chatType = null,
  title = null,
  // ✅ NEW: applied on INSERT only (when chat is first seen)
  isActiveInsert = null,
  lastSeenAt = null,
  meta = null,
}) {
  const res = await pool.query(
    `
    INSERT INTO chats (chat_id, transport, chat_type, title, is_active, last_seen_at, meta, updated_at)
    VALUES ($1, $2, $3, $4, COALESCE($5::boolean, TRUE), $6, COALESCE($7::jsonb, '{}'::jsonb), NOW())
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
    [
      String(chatId),
      String(transport),
      chatType,
      title,
      isActiveInsert === null || isActiveInsert === undefined ? null : !!isActiveInsert,
      lastSeenAt,
      meta ? JSON.stringify(meta) : null,
    ]
  );

  return res.rows?.[0] || null;
}

export async function getChatById({ chatId, transport = "telegram" }) {
  const res = await pool.query(
    `
    SELECT chat_id, transport, chat_type, title, is_active, updated_at, last_seen_at, deactivated_at, deactivated_by, deactivate_reason
    FROM chats
    WHERE chat_id = $1 AND transport = $2
    LIMIT 1
    `,
    [String(chatId), String(transport)]
  );

  return res.rows?.[0] || null;
}

export async function setChatActive({
  chatId,
  transport = "telegram",
  isActive,
  by = null,
  reason = null,
}) {
  const active = !!isActive;

  const res = await pool.query(
    `
    UPDATE chats
    SET
      is_active = $3::boolean,
      deactivated_at = CASE WHEN $3::boolean = FALSE THEN NOW() ELSE NULL END,
      deactivated_by = CASE WHEN $3::boolean = FALSE THEN COALESCE($4, deactivated_by) ELSE NULL END,
      deactivate_reason = CASE WHEN $3::boolean = FALSE THEN COALESCE($5, deactivate_reason) ELSE NULL END,
      updated_at = NOW()
    WHERE chat_id = $1 AND transport = $2
    RETURNING chat_id, transport, is_active, deactivated_at, deactivated_by, deactivate_reason
    `,
    [String(chatId), String(transport), active, by, reason]
  );

  return res.rows?.[0] || null;
}
