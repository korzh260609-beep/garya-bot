// users/userProfile.js
// Профиль пользователя: создание/обновление записи в таблице users.

import pool from "../../db.js";

export async function ensureUserProfile(msg) {
  const chatId = msg.chat.id.toString();
  const tgUserId = msg.from?.id?.toString() || null;
  const nameFromTelegram = msg.from?.first_name || null;

  let role = "guest";
  let finalName = nameFromTelegram;

  // монарх
  if (chatId === "677128443") {
    role = "monarch";
    finalName = "GARY";
  }

  try {
    const existing = await pool.query(
      "SELECT * FROM users WHERE chat_id = $1",
      [chatId]
    );

if (existing.rows.length === 0) {
  await pool.query(
    `
      INSERT INTO users (chat_id, tg_user_id, name, role, language)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      chatId,
      tgUserId,
      finalName,
      role,
      msg.from?.language_code || null,
    ]
  );
}
      console.log(`👤 Новый пользователь: ${finalName} (${role})`);
    } else {
      const user = existing.rows[0];
      if (user.name !== finalName) {
        await pool.query("UPDATE users SET name = $1 WHERE chat_id = $2", [
          finalName,
          chatId,
        ]);
      }
    }
  } catch (err) {
    console.error("❌ Error in ensureUserProfile:", err);
  }
}

