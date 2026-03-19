// src/db/userChatLinkRepo.js
// Stage 4 — user <-> chat links skeleton (identity-level -> transport-level)
//
// IMPORTANT:
// Current DB conflict key appears to be (global_user_id, chat_id) without transport.
// That is unsafe for future multi-transport usage.
// Here we add app-level protection to avoid silently overwriting a link
// when the same chat_id exists under another transport.
// Real fix requires DB migration.

import pool from "../../db.js";

export async function touchUserChatLink({
  globalUserId,
  chatId,
  transport = "telegram",
  lastSeenAt = null,
  meta = null,
}) {
  const gid = String(globalUserId || "").trim();
  const cid = String(chatId || "").trim();
  const tr = String(transport || "telegram").trim() || "telegram";

  if (!gid || !cid) {
    return null;
  }

  const normalizedMeta = meta ? JSON.stringify(meta) : null;

  // Guard against cross-transport silent overwrite.
  // Because current conflict key likely ignores transport, we check existing row first.
  const existingRes = await pool.query(
    `
    SELECT global_user_id, chat_id, transport, last_seen_at, meta
    FROM user_chat_links
    WHERE global_user_id = $1 AND chat_id = $2
    LIMIT 1
    `,
    [gid, cid]
  );

  const existing = existingRes.rows?.[0] || null;

  if (existing && String(existing.transport || "").trim() !== tr) {
    console.warn("touchUserChatLink transport conflict skipped", {
      globalUserId: gid,
      chatId: cid,
      existingTransport: existing.transport,
      incomingTransport: tr,
    });

    return {
      global_user_id: existing.global_user_id,
      chat_id: existing.chat_id,
      transport: existing.transport,
      conflict: true,
      skipped: true,
    };
  }

  const res = await pool.query(
    `
    INSERT INTO user_chat_links (global_user_id, chat_id, transport, last_seen_at, meta)
    VALUES ($1, $2, $3, $4, COALESCE($5::jsonb, '{}'::jsonb))
    ON CONFLICT (global_user_id, chat_id)
    DO UPDATE SET
      transport = EXCLUDED.transport,
      last_seen_at = COALESCE(EXCLUDED.last_seen_at, user_chat_links.last_seen_at),
      meta = COALESCE(EXCLUDED.meta, user_chat_links.meta)
    RETURNING global_user_id, chat_id, transport
    `,
    [gid, cid, tr, lastSeenAt, normalizedMeta]
  );

  return res.rows?.[0] || null;
}