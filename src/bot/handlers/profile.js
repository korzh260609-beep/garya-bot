// src/bot/handlers/profile.js
import pool from "../../../db.js";

export async function handleProfile({ bot, chatId, chatIdStr, senderIdStr }) {
  try {
    const providerUserId = String(senderIdStr || "").trim();

    let globalUserId = null;

    // 1) Identity-first: resolve via user_identities (telegram:provider_user_id)
    if (providerUserId) {
      const idRes = await pool.query(
        `
        SELECT global_user_id
        FROM user_identities
        WHERE provider = 'telegram' AND provider_user_id = $1
        LIMIT 1
        `,
        [providerUserId]
      );
      globalUserId = idRes.rows?.[0]?.global_user_id || null;
    }

    // 2) Legacy fallback (allowed): try users by tg/global id (NOT by chat_id)
    if (!globalUserId && providerUserId) {
      const legacyRes = await pool.query(
        `
        SELECT global_user_id
        FROM users
        WHERE global_user_id = $1 OR tg_user_id = $2
        LIMIT 1
        `,
        [`tg:${providerUserId}`, providerUserId]
      );
      globalUserId = legacyRes.rows?.[0]?.global_user_id || null;
    }

    // NOTE: chatIdStr is transport-only. No DB lookup by chat_id here (Stage 4.6+).

    if (!globalUserId) {
      await bot.sendMessage(chatId, "Профиль не найден.");
      return;
    }

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
      WHERE global_user_id = $1
      LIMIT 1
      `,
      [globalUserId]
    );

    if (!userRes.rows.length) {
      await bot.sendMessage(chatId, "Профиль не найден.");
      return;
    }

    const u = userRes.rows[0];

    let identityLine = "Identity: (нет)";
    const idRes = await pool.query(
      `
      SELECT provider, provider_user_id
      FROM user_identities
      WHERE global_user_id = $1 AND provider = 'telegram'
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [globalUserId]
    );

    if (idRes.rows.length) {
      const id = idRes.rows[0];
      identityLine = `Identity: ${id.provider}:${id.provider_user_id}`;
    }

    await bot.sendMessage(
      chatId,
      [
        "🧾 Профиль",
        `chat_id (transport): ${u.chat_id || "(null)"}`,
        `global_user_id: ${u.global_user_id || "(null)"}`,
        `Имя: ${u.name || "(null)"}`,
        `Роль: ${u.role || "(null)"}`,
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
