// src/bot/handlers/profile.js
import pool from "../../../db.js";

export async function handleProfile({ bot, chatId, chatIdStr }) {
  const res = await pool.query(
    "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
    [chatIdStr]
  );

  if (!res.rows.length) {
    await bot.sendMessage(chatId, "Профиль не найден.");
    return;
  }

  const u = res.rows[0];
  await bot.sendMessage(
    chatId,
    `🧾 Профиль\nID: ${u.chat_id}\nИмя: ${u.name}\nРоль: ${u.role}\nСоздан: ${u.created_at}`
  );
}

