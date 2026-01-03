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

    case "/mode": {
      // SAFETY: if messageRouter didn't pass these yet, do NOT handle here.
      // That keeps legacy switch(cmd) behavior unchanged.
      if (typeof ctx.getAnswerMode !== "function") return { handled: false };
      if (typeof ctx.setAnswerMode !== "function") return { handled: false };
      if (typeof ctx.rest !== "string") return { handled: false };

      const { rest } = ctx;

      if (!rest) {
        const mode = await ctx.getAnswerMode(chatIdStr);
        await bot.sendMessage(chatId, `Текущий режим ответов: ${mode}`);
        return { handled: true };
      }

      const ok = await ctx.setAnswerMode(chatIdStr, rest);
      if (!ok) {
        await bot.sendMessage(chatId, "Недопустимый режим. Используй: short | normal | long");
        return { handled: true };
      }

      await bot.sendMessage(chatId, `Режим ответов установлен: ${rest}`);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
