// src/bot/handlers/usersStats.js
// Handler for /users_stats — extracted from commandDispatcher.js with NO behavior changes.

import pool from "../../../db.js";

export async function handleUsersStats({ bot, chatId, bypass }) {
  // DB-only (safe to extract). Access: monarch/bypass only.
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const totalRes = await pool.query("SELECT COUNT(*)::int AS total FROM users");
    const total = totalRes.rows[0]?.total ?? 0;

    // Count unique Telegram users (by tg_user_id) if the column exists.
    // Must NOT break /users_stats on older DB schema.
    let users = 0;
    try {
      const usersRes = await pool.query(`
        SELECT COUNT(DISTINCT tg_user_id)::int AS users
        FROM users
        WHERE tg_user_id IS NOT NULL
      `);
      users = usersRes.rows[0]?.users ?? 0;
    } catch (_) {
      users = 0;
    }

    const byRoleRes = await pool.query(`
      SELECT COALESCE(role, 'unknown') AS role,
             COUNT(*)::int AS count
      FROM users
      GROUP BY COALESCE(role, 'unknown')
      ORDER BY role
    `);

    let out = "👥 Статистика пользователей СГ\n\n";
    out += `Всего записей (чаты): ${total}\n`;
    out += `👤 Людей (уникальных): ${users}\n\n`;

    if (byRoleRes.rows.length) {
      out += "По ролям:\n";
      for (const r of byRoleRes.rows) out += `• ${r.role}: ${r.count}\n`;
    }

    await bot.sendMessage(chatId, out);
  } catch (e) {
    console.error("❌ Error in /users_stats:", e);
    await bot.sendMessage(chatId, "Не удалось получить статистику пользователей.");
  }
}

