// src/users/userAccess.js
// Архитектурно чистая версия — доступ через global_user_id

import pool from "../../db.js";

/**
 * resolveUserAccess
 * Получает доступ пользователя строго через global_user_id.
 * Никогда не использует chat_id как сущность пользователя.
 */
export async function resolveUserAccess(chatIdStr) {
  if (!chatIdStr) {
    throw new Error("resolveUserAccess: chatIdStr is required");
  }

  // 1️⃣ Получаем пользователя по transport chat_id
  const userRes = await pool.query(
    `
    SELECT global_user_id, role, language
    FROM users
    WHERE chat_id = $1
    LIMIT 1
    `,
    [chatIdStr]
  );

  if (userRes.rows.length === 0) {
    return {
      exists: false,
      role: "guest",
      global_user_id: null,
      language: "uk",
    };
  }

  const { global_user_id, role, language } = userRes.rows[0];

  // 2️⃣ Проверяем identity через user_identities
  const identityRes = await pool.query(
    `
    SELECT provider, provider_user_id
    FROM user_identities
    WHERE global_user_id = $1
    LIMIT 1
    `,
    [global_user_id]
  );

  const identity =
    identityRes.rows.length > 0
      ? `${identityRes.rows[0].provider}:${identityRes.rows[0].provider_user_id}`
      : null;

  return {
    exists: true,
    role: role || "guest",
    global_user_id,
    language: language || "uk",
    identity,
  };
}
