// src/db/chatMeta.js
// STAGE 7B.8 — chat_meta registry (groups as sources)
// Minimal, fail-open helpers.

import pool from "../../db.js";

/**
 * Upsert chat_meta on every inbound/outbound message.
 * - Uses existing unique key: (transport, chat_id)
 * - Populates new columns from STAGE 7B.8 migration: platform/chat_type/title/alias
 * - Fail-open: caller should wrap in try/catch (but we also keep it safe here).
 */
export async function touchChatMeta({
  transport,
  chatId,
  chatType = null,
  title = null,
  role = null, // "user" | "assistant"
}) {
  if (!transport || !chatId) return;

  try {
    await pool.query(
      `
      INSERT INTO chat_meta (
        transport,
        chat_id,
        platform,
        chat_type,
        title,
        message_count,
        last_message_at,
        last_role,
        schema_version,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2,
        $3, $4, $5,
        1,
        now(),
        $6,
        1,
        now(),
        now()
      )
      ON CONFLICT (transport, chat_id)
      DO UPDATE SET
        platform = COALESCE(EXCLUDED.platform, chat_meta.platform),
        chat_type = COALESCE(EXCLUDED.chat_type, chat_meta.chat_type),
        title = COALESCE(EXCLUDED.title, chat_meta.title),
        message_count = chat_meta.message_count + 1,
        last_message_at = now(),
        last_role = COALESCE(EXCLUDED.last_role, chat_meta.last_role),
        updated_at = now()
      `,
      [
        String(transport),
        String(chatId),
        String(transport), // platform: пока = transport (telegram). позже можно развести.
        chatType ? String(chatType) : null,
        title ? String(title) : null,
        role ? String(role) : null,
      ]
    );
  } catch (e) {
    // fail-open (do not break production)
    console.error("❌ chat_meta touch failed (fail-open):", e?.message || e);
  }
}
