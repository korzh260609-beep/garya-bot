// src/users/userProfile.js
// STAGE 4.2 — Multi-Channel Identity foundation
// Safety: в groups не пишем users по chat_id (там chat_id = group id)

import pool from "../../db.js";
import { envStr } from "../core/config.js";

export async function ensureUserProfile(msg) {
  const chatId = msg.chat?.id?.toString();
  const chatType = msg.chat?.type || null;

  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;
  const language = msg.from?.language_code || null;

  if (!chatId || !tgUserId) return;

  // CRITICAL SAFETY: avoid corrupting users table in group/supergroup/channel
  if (chatType !== "private") return;

  const globalUserId = `tg:${tgUserId}`;

  // ✅ Stage 4: monarch identity from centralized config (no direct process.env)
  const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();

  let role = "guest";
  let finalName = nameFromTelegram;

  // Monarch must be bound to tgUserId (msg.from.id), not chatId
  if (MONARCH_USER_ID && tgUserId === MONARCH_USER_ID) {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    // Keep legacy chat_id column updated for private chat only (transport/compat),
    // but identity truth is global_user_id.
    await pool.query(
      `
      INSERT INTO users (chat_id, global_user_id, tg_user_id, name, role, language)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (chat_id)
      DO UPDATE SET
        global_user_id = EXCLUDED.global_user_id,
        tg_user_id = EXCLUDED.tg_user_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        language = EXCLUDED.language
      `,
      [chatId, globalUserId, tgUserId, finalName, role, language]
    );

    // Link identity (telegram -> global_user_id)
    await pool.query(
      `
      INSERT INTO user_identities (global_user_id, provider, provider_user_id, chat_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (provider, provider_user_id)
      DO NOTHING
      `,
      [globalUserId, "telegram", tgUserId, chatId]
    );
  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}
