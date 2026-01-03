// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import pool from "../../db.js";

export async function dispatchCommand(cmd, ctx) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd) {
    case "/profile":
    case "/me":
    case "/whoami": {
      const res = await pool.query(
        "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
        [chatIdStr]
      );

      if (!res.rows.length) {
        await bot.sendMessage(chatId, "Профиль не найден.");
        return { handled: true };
      }

      const u = res.rows[0];
      await bot.sendMessage(
        chatId,
        `🧾 Профиль\nID: ${u.chat_id}\nИмя: ${u.name}\nРоль: ${u.role}\nСоздан: ${u.created_at}`
      );
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
