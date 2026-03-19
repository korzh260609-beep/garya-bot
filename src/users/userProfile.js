// src/users/userProfile.js
// STAGE 4.2 — Multi-Channel Identity foundation
//
// IMPORTANT:
// - In groups, msg.chat.id is GROUP ID. We must NOT store it as user chat_id.
// - For identity capture in groups, we use synthetic chat_id = tg_user_id.
// - This enables identity tracking for users who interact only in group.
//
// STABILIZATION NOTES:
// - Identity mapping (user_identities) is preferred as source for global_user_id.
// - users.chat_id remains legacy-compatible write path because current DB shape still uses it.
// - We do NOT hijack existing provider identity mappings here.
// - We avoid unnecessary dependence on users.chat_id as identity source when a provider mapping already exists.

import pool from "../../db.js";
import { envStr } from "../core/config.js";
import {
  resolveGlobalUserIdForTelegramUser,
  generateUniqueGlobalUserId,
} from "./globalUserId.js";

export async function ensureUserProfile(msg) {
  const rawChatId = msg.chat?.id?.toString() || null;
  const chatType = msg.chat?.type || null;

  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;
  const language = msg.from?.language_code || null;

  if (!tgUserId) return;

  const isPrivate = chatType === "private" || (rawChatId && rawChatId === tgUserId);
  const effectiveChatIdStr = isPrivate
    ? String(rawChatId || tgUserId)
    : String(tgUserId);

  const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();

  let role = "guest";
  let finalName = nameFromTelegram;

  if (MONARCH_USER_ID && tgUserId === MONARCH_USER_ID) {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    let globalUserId = null;

    // 1) First: provider identity mapping is source of truth
    globalUserId = await resolveGlobalUserIdForTelegramUser(tgUserId);

    // 2) Legacy fallback by current effective chat_id (kept only for compatibility)
    if (!globalUserId) {
      const byChatRes = await pool.query(
        `
        SELECT global_user_id
        FROM users
        WHERE chat_id = $1
        LIMIT 1
        `,
        [effectiveChatIdStr]
      );

      globalUserId = byChatRes.rows?.[0]?.global_user_id || null;
    }

    // 3) Still none -> create new SG-issued id
    if (!globalUserId) {
      globalUserId = await generateUniqueGlobalUserId();
    }

    // users table remains legacy-compatible profile store.
    // chat_id here is identity-safe:
    // - private chat id
    // - or synthetic tg user id for groups
    await pool.query(
      `
      INSERT INTO users (chat_id, global_user_id, tg_user_id, name, role, language)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (chat_id)
      DO UPDATE SET
        global_user_id = COALESCE(users.global_user_id, EXCLUDED.global_user_id),
        tg_user_id = EXCLUDED.tg_user_id,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        language = EXCLUDED.language
      `,
      [effectiveChatIdStr, globalUserId, tgUserId, finalName, role, language]
    );

    // Provider identity mapping:
    // keep existing mapping untouched if already present
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