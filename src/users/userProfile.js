// src/users/userProfile.js
// STAGE 4.2 — Multi-Channel Identity foundation (SAFE: only private chat upsert by chat_id)

import pool from "../../db.js";

const MONARCH_TG_ID = "677128443";

export async function ensureUserProfile(msg) {
  const chatId = msg.chat?.id?.toString();
  const chatType = msg.chat?.type || null;

  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;
  const language = msg.from?.language_code || null;

  if (!chatId || !tgUserId) return;

  // ✅ CRITICAL SAFETY: avoid corrupting users table in group/supergroup/channel
  // Because chat_id there is group id, not a user id.
  if (chatType !== "private") return;

  const globalUserId = `tg:${tgUserId}`;

  let role = "guest";
  let finalName = nameFromTelegram;

  // ✅ MONARCH must be bound to tgUserId, not chatId
  if (tgUserId === MONARCH_TG_ID) {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    // ✅ Safe with unique chat_id constraint (private chat: chatId == userId)
    await pool.query(
      `
      INSERT INTO users (chat_id, global_user_id, name, role, language)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chat_id)
      DO UPDATE SET
        global_user_id = EXCLUDED.global_user_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        language = EXCLUDED.language
      `,
      [chatId, globalUserId, finalName, role, language]
    );

    // ✅ Link identity (telegram -> global_user_id)
    await pool.query(
      `
      INSERT INTO user_identities (global_user_id, provider, provider_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (provider, provider_user_id)
      DO NOTHING
      `,
      [globalUserId, "telegram", tgUserId]
    );
  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}
