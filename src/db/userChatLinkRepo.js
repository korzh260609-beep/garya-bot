// src/db/userChatLinkRepo.js
// Stage 4 — user <-> chat links skeleton (identity-level -> transport-level)

import pool from "../../db.js";

export async function touchUserChatLink({
  globalUserId,
  chatId,
  transport = "telegram",
  lastSeenAt = null,
  meta = null,
}) {
  // Skeleton only: used later by router (not wired yet)
  const res = await pool.query(
    `
    INSERT INTO user_chat_links (global_user_id, chat_id, transport, last_seen_at, meta)
    VALUES ($1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb))
    ON CONFLICT (global_user_id, chat_id)
    DO UPDATE SET
      transport = EXCLUDED.transport,
      last_seen_at = COALESCE(EXCLUDED.last_seen_at, user_chat_links.last_seen_at),
      meta = COALESCE(EXCLUDED.meta, user_chat_links.meta)
    RETURNING global_user_id, chat_id
    `,
    [
      String(globalUserId),
      String(chatId),
      String(transport),
      lastSeenAt,
      meta ? JSON.stringify(meta) : null,
    ]
  );

  return res.rows?.[0] || null;
}
