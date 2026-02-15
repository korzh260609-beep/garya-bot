// users/userProfile.js
// STAGE 4.2 — Multi-Channel Identity foundation

import pool from "../../db.js";

export async function ensureUserProfile(msg) {
  const chatId = msg.chat.id.toString();
  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;
  const language = msg.from?.language_code || null;

  if (!tgUserId) return;

  const globalUserId = `tg:${tgUserId}`;

  let role = "guest";
  let finalName = nameFromTelegram;

  // MONARCH
  if (chatId === "677128443") {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    // 1️⃣ USERS table (bind to global_user_id)
    const existing = await pool.query(
      "SELECT * FROM users WHERE global_user_id = $1",
      [globalUserId]
    );

    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO users (chat_id, global_user_id, name, role, language)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [chatId, globalUserId, finalName, role, language]
      );

      console.log(`👤 New user created: ${finalName} (${role})`);
    } else {
      const user = existing.rows[0];

      if (user.name !== finalName) {
        await pool.query(
          "UPDATE users SET name = $1 WHERE global_user_id = $2",
          [finalName, globalUserId]
        );
      }
    }

    // 2️⃣ user_identities table (platform link)
    await pool.query(
      `
      INSERT INTO user_identities (global_user_id, provider, provider_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (provider, provider_user_id)
      DO NOTHING
      `,
      [globalUserId, "telegram", tgUserId]
    );

    // 🔎 TEMP DIAG (remove after check)
    // Если тут rows пустой — вероятно нет UNIQUE(provider, provider_user_id) или вставка не прошла
    const check = await pool.query(
      "SELECT global_user_id, provider, provider_user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2",
      ["telegram", tgUserId]
    );
    console.log("🔎 Identity check:", check.rows);

  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}
