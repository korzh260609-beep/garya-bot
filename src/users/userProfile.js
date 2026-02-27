// src/users/userProfile.js
// STAGE 4.2 — Multi-Channel Identity foundation
// IMPORTANT:
// - In groups, msg.chat.id is GROUP ID. We must NOT store it as user chat_id.
// - For identity capture in groups, we use synthetic chat_id = tg_user_id (same as private chat id).
// - This enables identity tracking for users who interact only in group.

import pool from "../../db.js";
import { envStr } from "../core/config.js";
import {
  resolveGlobalUserIdForTelegramUser,
  generateUniqueGlobalUserId,
} from "./globalUserId.js";

export async function ensureUserProfile(msg) {
  const rawChatId = msg.chat?.id?.toString();
  const chatType = msg.chat?.type || null;

  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;
  const language = msg.from?.language_code || null;

  if (!tgUserId) return;

  // ✅ Identity-safe chat_id:
  // - private: real chat id
  // - group/supergroup: synthetic chat id = tg user id (prevents corrupting users with group chat_id)
  const isPrivate = chatType === "private" || (rawChatId && rawChatId === tgUserId);
  const effectiveChatIdStr = isPrivate ? String(rawChatId || tgUserId) : String(tgUserId);

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
    // 1) If user already exists by effective chat_id, keep its global_user_id (avoid breaking DB links)
    const byChatRes = await pool.query(
      `
      SELECT global_user_id
      FROM users
      WHERE chat_id = $1
      LIMIT 1
      `,
      [effectiveChatIdStr]
    );

    let globalUserId = byChatRes.rows?.[0]?.global_user_id || null;

    // 2) Else resolve via identity/legacy fallback (may return tg:<id> or usr_<id>)
    if (!globalUserId) {
      globalUserId = await resolveGlobalUserIdForTelegramUser(tgUserId);
    }

    // 3) If still none => create NEW SG-issued id (usr_<...>)
    if (!globalUserId) {
      globalUserId = await generateUniqueGlobalUserId();
    }

    // users table represents USER profile (identity-level).
    // chat_id here is identity-safe: private chat id OR synthetic tg user id.
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
      [effectiveChatIdStr, globalUserId, tgUserId, finalName, role, language]
    );

    // Link identity (telegram -> global_user_id)
    // IMPORTANT: do NOT hijack existing mapping; if it exists, keep it (migration is a separate step)
    await pool.query(
      `
      INSERT INTO user_identities (global_user_id, provider, provider_user_id, chat_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (provider, provider_user_id)
      DO NOTHING
      `,
      [globalUserId, "telegram", tgUserId, effectiveChatIdStr]
    );
  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}
