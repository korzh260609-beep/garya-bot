// src/bot/handlers/profile.js
import pool from "../../../db.js";

export async function handleProfile({ bot, chatId, chatIdStr }) {
  try {
    const userRes = await pool.query(
      `
      SELECT
        chat_id,
        global_user_id,
        name,
        role,
        language,
        created_at
      FROM users
      WHERE chat_id = $1
      `,
      [chatIdStr]
    );

    if (!userRes.rows.length) {
      await bot.sendMessage(chatId, "Профиль не найден.");
      return;
    }

    const u = userRes.rows[0];

    let identityLine = "Identity: (нет)";
    if (u.global_user_id) {
      const idRes = await pool.query(
        `
        SELECT provider, provider_user_id
        FROM user_identities
        WHERE global_user_id = $1 AND provider = 'telegram'
        ORDER BY created_at ASC
        LIMIT 1
        `,
        [u.global_user_id]
      );

      if (idRes.rows.length) {
        const id = idRes.rows[0];
        identityLine = `Identity: ${id.provider}:${id.provider_user_id}`;
      }
    }

    await bot.sendMessage(
      chatId,
      [
        "🧾 Профиль",
        `chat_id: ${u.chat_id}`,
        `global_user_id: ${u.global_user_id || "(null)"}`,
        `Имя: ${u.name}`,
        `Роль: ${u.role}`,
        `Язык: ${u.language || "(null)"}`,
        identityLine,
        `Создан: ${u.created_at}`,
      ].join("\n")
    );
  } catch (err) {
    console.error("❌ Error in handleProfile:", err);
    await bot.sendMessage(chatId, "Ошибка профиля (см. логи).");
  }
}
